((globalThis.MoulinDetails29 = function (t, n) {
  const { model: A, standard: re, rgb: R, materials: he } = n,
    te = { roofMaterials: 0, roofFlashing: 0, terraceMaterials: 0 },
    O = re("#849391", { roughness: 0.69, metalness: 0.28 }),
    T = A.getObjectByName("Moulin");
  if (T) {
    const X = [];
    for (const pe of [-6.2, 6.3])
      for (const q of [-1, 1]) {
        const v = q * 0.48,
          k = q * 0.8,
          h = 10.1 - (Math.abs(v) * 3.65) / 4.5 + 0.04,
          b = 10.1 - (Math.abs(k) * 3.65) / 4.5 + 0.04;
        for (const p of [-0.57, 0.57]) {
          const S = [v, h, pe + p],
            x = [k, b, pe + p],
            c = [k, b, pe + p + (p > 0 ? 0.18 : -0.18)],
            P = [v, h, pe + p + (p > 0 ? 0.18 : -0.18)];
          X.push(...S, ...x, ...c, ...S, ...c, ...P);
        }
      }
    const a = new t.BufferGeometry();
    (a.setAttribute("position", new t.Float32BufferAttribute(X, 3)), a.computeVertexNormals());
    const _e = new t.Mesh(a, O);
    ((_e.name = "Solins_en_zinc_des_cheminees"),
      (_e.material.side = t.DoubleSide),
      (_e.receiveShadow = !0),
      T.add(_e),
      (te.roofFlashing = X.length / 9));
  }
  const le = new Set();
  return (
    A.traverse((X) => {
      var k;
      if (!X.isMesh || Array.isArray(X.material) || le.has(X.material)) return;
      const a = X.name === "Toiture_ardoise",
        _e = X.name === "Dalles_de_la_terrasse";
      if (!a && !_e) return;
      const pe = X.material;
      le.add(pe);
      const q = pe.onBeforeCompile,
        v = ((k = pe.customProgramCacheKey) == null ? void 0 : k.call(pe)) || "";
      ((pe.onBeforeCompile = function (h, b) {
        (q == null || q.call(this, h, b),
          (h.fragmentShader = h.fragmentShader.replace(
            "#include <color_fragment>",
            `#include <color_fragment>
 #ifdef USE_MAP
 vec2 detailCell29=floor(vUv*vec2(${a ? "10.,8." : "5.,5."}));
 float detailTint29=fract(sin(dot(detailCell29,vec2(127.1,311.7)))*43758.5453);
 float detailAge29=.5+.5*sin(vUv.x*17.+sin(vUv.y*11.));
 diffuseColor.rgb*=mix(vec3(${a ? ".87,.91,.94" : " .94,.92,.87"}),vec3(${a ? "1.08,1.065,1.02" : "1.045,1.045,1.025"}),detailTint29);
 diffuseColor.rgb*=1.-detailAge29*${a ? ".035" : ".025"};
 #endif
 `,
          )));
      }),
        (pe.customProgramCacheKey = () => v + "|moulin-detail29-" + (a ? "slate" : "terrace")),
        (pe.needsUpdate = !0),
        a ? te.roofMaterials++ : te.terraceMaterials++);
    }),
    { stats: te }
  );
}),
  (globalThis.MoulinWildlife29 = function (t, n) {
    "use strict";
    const A = new t.Group();
    ((A.name = "Oiseaux_et_grenouilles"), (A.userData.dynamic25 = !0), n.model.add(A));
    const re = n.standard("#ffffff", { vertexColors: !0, roughness: 0.88, flatShading: !0, side: t.DoubleSide }),
      R = new t.Object3D(),
      he = new t.Vector3(0, 1, 0),
      te = t.MathUtils.clamp,
      O = { ico: new t.IcosahedronGeometry(1, 1), low: new t.IcosahedronGeometry(1, 0) };
    function T(st) {
      const $ = [],
        U = [],
        He = [];
      function Ce(De, ke, rt = [0, 0, 0], $e = [1, 1, 1], B = [0, 0, 0]) {
        const F = De.index ? De.toNonIndexed() : De.clone();
        (R.position.set(...rt),
          R.scale.set(...$e),
          R.rotation.set(...B),
          R.updateMatrix(),
          F.applyMatrix4(R.matrix),
          F.attributes.normal || F.computeVertexNormals());
        const g = n.rgb(ke),
          G = F.attributes.position,
          Qe = F.attributes.normal;
        for (let Fe = 0; Fe < G.count; Fe++)
          ($.push(G.getX(Fe), G.getY(Fe), G.getZ(Fe)),
            U.push(Qe.getX(Fe), Qe.getY(Fe), Qe.getZ(Fe)),
            He.push(g.r, g.g, g.b));
        F.dispose();
      }
      st({
        blob: (De, ke, rt, $e = !1) => Ce($e ? O.low : O.ico, De, ke, rt),
        pole: (De, ke, rt, $e = 0.02, B = $e) => {
          const F = new t.Vector3(...ke),
            g = new t.Vector3(...rt),
            G = new t.CylinderGeometry(B, $e, F.distanceTo(g), 5);
          (G.applyMatrix4(
            new t.Matrix4().makeRotationFromQuaternion(
              new t.Quaternion().setFromUnitVectors(he, g.clone().sub(F).normalize()),
            ),
          ),
            Ce(G, De, F.add(g).multiplyScalar(0.5).toArray()),
            G.dispose());
        },
        triangle: (De, ke, rt, $e) => {
          const B = new t.BufferGeometry();
          (B.setAttribute("position", new t.Float32BufferAttribute([...De, ...ke, ...rt], 3)),
            B.computeVertexNormals(),
            Ce(B, $e),
            B.dispose());
        },
        add: Ce,
      });
      const D = new t.BufferGeometry();
      return (
        D.setAttribute("position", new t.Float32BufferAttribute($, 3)),
        D.setAttribute("normal", new t.Float32BufferAttribute(U, 3)),
        D.setAttribute("color", new t.Float32BufferAttribute(He, 3)),
        D.computeBoundingSphere(),
        D
      );
    }
    function le(st, $ = A) {
      const U = new t.Mesh(st, re);
      return ((U.castShadow = !1), (U.receiveShadow = !0), $.add(U), U);
    }
    const X = T(({ blob: st, pole: $, triangle: U }) => {
        (st("#819394", [0, 0.93, 0], [0.24, 0.29, 0.45]), st("#c2c7ba", [0, 1.02, 0.2], [0.2, 0.25, 0.23]));
        for (const He of [-1, 1]) {
          (st("#4e6671", [He * 0.19, 0.96, -0.09], [0.11, 0.25, 0.36]),
            $("#988854", [He * 0.11, 0.81, 0.05], [He * 0.12, 0.39, 0.04], 0.019),
            $("#a29462", [He * 0.12, 0.39, 0.04], [He * 0.14, 0.03, 0.13], 0.015));
          for (const Ce of [-1, 0, 1])
            $("#827750", [He * 0.14, 0.025, 0.13], [He * 0.14 + Ce * 0.09, 0.01, 0.25], 0.01, 0.003);
        }
        U([-0.12, 0.9, -0.35], [0.12, 0.9, -0.35], [0, 0.88, -0.63], "#526770");
      }),
      a = T(({ blob: st, pole: $ }) => {
        ($("#b6c0b8", [0, 0, 0], [0, 0.24, -0.05], 0.085, 0.065),
          $("#d1d2c5", [0, 0.24, -0.05], [0, 0.46, 0.18], 0.066, 0.045),
          st("#e1dfcd", [0, 0.48, 0.21], [0.085, 0.094, 0.14]),
          $("#cead69", [0, 0.47, 0.3], [0, 0.445, 0.65], 0.042, 0.001));
        for (const U of [-1, 1])
          (st("#1f3440", [U * 0.056, 0.52, 0.15], [0.023, 0.024, 0.1]),
            st("#e3ba57", [U * 0.08, 0.49, 0.26], [0.014, 0.014, 0.014]),
            $("#314754", [U * 0.02, 0.54, 0.13], [U * 0.035, 0.5, -0.1], 0.012, 0.001));
      }),
      _e = T(({ blob: st, triangle: $ }) => {
        (st("#263b3e", [0, 0.09, 0], [0.22, 0.18, 0.43]),
          st("#34484a", [0, 0.18, -0.06], [0.19, 0.13, 0.32]),
          $([-0.12, 0.1, -0.35], [0.12, 0.1, -0.35], [0, 0.11, -0.72], "#203237"));
        for (const U of [-1, 1]) st("#3d5152", [U * 0.13, 0.13, 0], [0.07, 0.12, 0.3]);
      }),
      pe = T(({ blob: st, pole: $ }) => {
        ($("#2d4346", [0, 0, 0], [0, 0.25, 0.1], 0.065, 0.046),
          st("#2b4145", [0, 0.29, 0.14], [0.075, 0.075, 0.12]),
          st("#bd9b51", [0, 0.235, 0.21], [0.055, 0.055, 0.061]),
          $("#c8bc91", [0, 0.27, 0.24], [0, 0.25, 0.39], 0.022, 0.007));
        for (const U of [-1, 1]) st("#93b9a4", [U * 0.066, 0.3, 0.19], [0.014, 0.013, 0.013]);
      }),
      q = T(({ blob: st, triangle: $ }) => {
        (st("#bac0a9", [0, 0, 0], [0.029, 0.025, 0.11]),
          $([0, 0, -0.08], [-0.06, 0, -0.16], [0.06, 0, -0.16], "#849c93"));
      }),
      v = T(({ blob: st, triangle: $ }) => {
        (st("#d3d6cc", [0, 0, 0], [0.08, 0.075, 0.22]),
          st("#e6e5d5", [0, 0.065, 0.17], [0.063, 0.06, 0.08]),
          $([-0.02, 0.055, 0.22], [0.02, 0.055, 0.22], [0, 0.045, 0.32], "#cfb170"),
          $([-0.09, 0, -0.18], [0.09, 0, -0.18], [0, -0.018, -0.35], "#7d908e"));
      }),
      k = T(({ triangle: st }) => {
        (st([0, 0, 0.08], [0.45, 0.025, 0.16], [0.58, 0, -0.19], "#acb9b5"),
          st([0, 0, 0.08], [0.58, 0, -0.19], [0.08, 0, -0.14], "#c4cdc3"),
          st([0.45, 0.025, 0.16], [0.89, -0.02, -0.18], [0.58, 0, -0.19], "#46595c"));
      }),
      h = new t.Group();
    ((h.name = "Vols_au_dessus_des_etangs"), A.add(h));
    const b = [];
    for (let st = 0; st < (n.mobile ? 7 : 11); st++) {
      const $ = new t.Group();
      (h.add($), le(v, $));
      const U = [le(k, $), le(k, $)];
      U[1].scale.x = -1;
      const He = 0.85 + (st % 3) * 0.12;
      ($.scale.setScalar(He), b.push({ g: $, wings: U, phase: st * 1.7 }));
    }
    function p() {
      var $;
      const st = [];
      for (let U = 0; U < Math.min(3, n.waterRegions.length); U++) {
        const He = n.waterRegions[U],
          Ce = He.poly;
        for (let xe = 3; xe < Ce.length; xe += Math.max(1, Math.floor(Ce.length / 42))) {
          const H = Ce[xe],
            W = Ce[(xe + 1) % Ce.length],
            D = W[0] - H[0],
            De = W[1] - H[1],
            ke = Math.hypot(D, De) || 1;
          let rt = -De / ke,
            $e = D / ke;
          const B = (H[0] + W[0]) / 2,
            F = (H[1] + W[1]) / 2;
          n.inside([B + rt * 0.5, F + $e * 0.5], Ce) && ((rt = -rt), ($e = -$e));
          const g = [B + rt * 0.55, F + $e * 0.55],
            G = [B - rt * 1.55, F - $e * 1.55];
          if (
            n.wetAt(g, 0.12) ||
            !n.inside(G, Ce) ||
            n.islands.some((Fe) => n.inside(G, Fe)) ||
            (($ = n.protectedSite) != null && $.call(n, ...g))
          )
            continue;
          const Qe = n.terrainHeight(...g);
          Qe < He.level + 0.015 ||
            Qe > He.level + 1.2 ||
            st.push({ region: U, dry: g, wet: G, edge: [B, F], out: [rt, $e], level: He.level });
        }
      }
      return st;
    }
    let S = p();
    function x(st) {
      return (
        S[(st * 7 + 3) % Math.max(1, S.length)] || {
          region: 0,
          dry: [0, 22],
          wet: [0, 24],
          edge: [0, 23],
          out: [0, -1],
          level: 0,
        }
      );
    }
    const c = [];
    for (let st = 0; st < 5; st++) {
      const $ = st < 2,
        U = new t.Group();
      ((U.name = $ ? "Heron_cendre_" + st : "Cormoran_pecheur_" + st), A.add(U), le($ ? X : _e, U));
      const He = new t.Group();
      (He.position.set(0, $ ? 1.09 : 0.18, $ ? 0.22 : 0.27), U.add(He), le($ ? a : pe, He));
      const Ce = le(q, He);
      (Ce.position.set(0, $ ? 0.44 : 0.25, $ ? 0.63 : 0.37),
        (Ce.rotation.x = 0.6),
        (Ce.visible = !1),
        c.push({ g: U, neck: He, fish: Ce, heron: $, site: x(st + 1), phase: st * 8.9, wasDiving: !1 }));
    }
    const P = T(({ blob: st }) => {
        (st("#667d39", [0, 0.08, 0], [0.14, 0.092, 0.18]),
          st("#839648", [0, 0.095, 0.12], [0.13, 0.065, 0.095]),
          st("#b2b983", [0, 0.047, 0.1], [0.09, 0.024, 0.1]));
        for (const $ of [-1, 1])
          (st("#9ba755", [$ * 0.087, 0.153, 0.15], [0.039, 0.039, 0.041]),
            st("#172d28", [$ * 0.087, 0.167, 0.178], [0.019, 0.025, 0.013]),
            st("#d9daab", [$ * 0.089, 0.178, 0.186], [0.008, 0.008, 0.005]),
            st("#81904b", [$ * 0.12, 0.025, 0.17], [0.075, 0.02, 0.05]));
        for (let $ = 0; $ < 7; $++)
          st(
            "#405e34",
            [Math.sin($ * 2.4) * 0.09, 0.157 + ($ % 2) * 0.013, Math.cos($ * 2.4) * 0.1],
            [0.017, 0.007, 0.021],
            !0,
          );
      }),
      C = T(({ blob: st }) => {
        for (const $ of [-1, 1])
          (st("#718340", [$ * 0.14, 0.049, -0.105], [0.091, 0.058, 0.116]),
            st("#8b9b52", [$ * 0.2, 0.019, -0.18], [0.055, 0.022, 0.12]));
      }),
      Ne = n.mobile ? 9 : 14,
      z = new t.InstancedMesh(P, re, Ne),
      ce = new t.InstancedMesh(C, re, Ne);
    for (const st of [z, ce])
      ((st.name = "Grenouilles_des_berges"),
        st.instanceMatrix.setUsage(t.DynamicDrawUsage),
        (st.frustumCulled = !1),
        (st.receiveShadow = !0),
        A.add(st));
    const V = Array.from({ length: Ne }, (st, $) => ({
        id: $,
        site: x($ + 7),
        state: "rest",
        phase: 0,
        cooldown: 0,
        jumps: 0,
        position: new t.Vector3(),
        scale: 0.8 + ($ % 4) * 0.13,
      })),
      Me = new t.RingGeometry(0.88, 1, 24);
    Me.rotateX(-Math.PI / 2);
    const je = new t.MeshBasicMaterial({
        color: n.rgb("#c2d4bf"),
        transparent: !0,
        opacity: 0.24,
        depthWrite: !1,
        side: t.DoubleSide,
      }),
      lt = new t.InstancedMesh(Me, je, 24);
    ((lt.name = "Ronds_des_plongeons"), (lt.frustumCulled = !1), A.add(lt));
    const Ke = Array.from({ length: 24 }, () => ({ life: 0, x: 0, z: 0, y: 0 }));
    let ve = 0,
      qe = 0;
    function Xe(st, $, U) {
      Object.assign(Ke[ve++ % Ke.length], { life: 1.5, x: st, z: $, y: U + 0.035 });
    }
    function _t() {
      ((S = p()),
        c.forEach((st, $) => {
          st.site = x($ + 1);
        }),
        V.forEach((st, $) => {
          ((st.site = x($ + 7)), (st.state = "rest"), (st.phase = 0), (st.cooldown = 0));
        }));
    }
    function Mt(st, $ = 0.033, U) {
      var W, D, De, ke, rt, $e, B;
      (($ = te($, 0, 0.12)), (qe += $));
      const He = U || ((D = (W = n.player) == null ? void 0 : W.getAudioState) == null ? void 0 : D.call(W)),
        Ce = (De = n.getMode) == null ? void 0 : De.call(n),
        xe = (ke = n.weather) == null ? void 0 : ke.call(n),
        H =
          (B = ($e = (rt = n.night) == null ? void 0 : rt.call(n)) == null ? void 0 : $e.getState) == null
            ? void 0
            : B.call($e).mode;
      h.visible =
        Ce !== "globe" &&
        H !== "stars" &&
        H !== "black" &&
        !["storm", "snow", "rain"].includes(xe == null ? void 0 : xe.mode);
      for (let F = 0; F < b.length; F++) {
        const g = b[F],
          G = qe * 0.085 + g.phase * 0.09,
          Qe = -20 + Math.cos(G) * (34 + F * 0.75) + F * 0.75,
          Fe = 37 + Math.sin(G) * (23 + F * 0.3);
        (g.g.position.set(Qe, 19 + Math.sin(qe * 0.16 + g.phase) * 1.8 + (F % 4) * 1.5, Fe),
          g.g.rotation.set(0.04, Math.atan2(-Math.sin(G) * 34, Math.cos(G) * 23), -0.12 * Math.sin(G)));
        const Le = Math.sin(qe * 5.2 + g.phase) * 0.48 * (Math.sin(qe * 0.38 + g.phase) > 0.15 ? 1 : 0.12);
        ((g.wings[0].rotation.z = Le), (g.wings[1].rotation.z = -Le));
      }
      for (let F = 0; F < c.length; F++) {
        const g = c[F],
          G = g.site,
          Qe = (qe + g.phase) % 34,
          Fe = Math.atan2(-G.out[0], -G.out[1]);
        if (((g.g.rotation.y = Fe), g.heron)) {
          g.g.position.set(G.edge[0] - G.out[0] * 0.28, G.level - 0.09, G.edge[1] - G.out[1] * 0.28);
          const Le = Qe > 22 && Qe < 25 ? Math.sin(((Qe - 22) / 3) * Math.PI) : 0;
          ((g.neck.rotation.x = Le * 1.9 + 0.04 * Math.sin(qe * 0.7 + F)),
            (g.g.rotation.x = Le * 0.19),
            (g.fish.visible = Qe > 24.5 && Qe < 27.2),
            Le > 0.98 && !g.wasDiving && Xe(G.wet[0], G.wet[1], G.level),
            (g.wasDiving = Le > 0.98));
        } else {
          const Le = qe * 0.15 + F,
            pt = G.wet[0] + Math.cos(Le) * 0.45,
            Ge = G.wet[1] + Math.sin(Le) * 0.45,
            m = Qe > 18 && Qe < 25;
          (g.g.position.set(
            pt,
            G.level +
              0.035 +
              (m ? -Math.sin((Math.min(1, (Qe - 18) / 1.1) * Math.PI) / 2) * 0.8 : Math.sin(qe * 2 + F) * 0.015),
            Ge,
          ),
            (g.g.rotation.y = Math.atan2(-Math.sin(Le), Math.cos(Le))),
            (g.g.rotation.x = m ? Math.min(0.7, (Qe - 18) * 0.8) : 0),
            (g.g.visible = !m || Qe < 19.2),
            (g.neck.rotation.x = 0.12 + Math.sin(qe * 0.5 + F) * 0.08),
            (g.fish.visible = Qe > 25 && Qe < 27),
            m && !g.wasDiving && Xe(pt, Ge, G.level),
            !m && g.wasDiving && Xe(pt, Ge, G.level),
            (g.wasDiving = m));
        }
      }
      for (let F = 0; F < V.length; F++) {
        const g = V[F],
          G = g.site,
          Qe = n.terrainHeight(...G.dry) + 0.015,
          Fe = He != null && He.position ? Math.hypot(He.position.x - G.dry[0], He.position.z - G.dry[1]) : 999;
        if (
          ((g.cooldown = Math.max(0, g.cooldown - $)),
          g.state === "rest" &&
            g.cooldown === 0 &&
            He != null &&
            He.enabled &&
            He.running &&
            He.speed > 3 &&
            !He.vehicle &&
            Fe < 5.5 &&
            ((g.state = "jump"), (g.phase = 0), g.jumps++),
          g.state === "jump")
        ) {
          g.phase += $;
          const Le = te(g.phase / 0.68, 0, 1);
          (g.position.set(
            G.dry[0] + (G.wet[0] - G.dry[0]) * Le,
            Qe + (G.level - 0.06 - Qe) * Le + Math.sin(Le * Math.PI) * 0.72,
            G.dry[1] + (G.wet[1] - G.dry[1]) * Le,
          ),
            Le === 1 && ((g.state = "water"), (g.phase = 0), Xe(G.wet[0], G.wet[1], G.level)));
        } else if (g.state === "water")
          ((g.phase += $),
            g.position.set(G.wet[0], G.level - 0.35, G.wet[1]),
            g.phase > 12 + F * 0.7 && Fe > 9 && ((g.state = "return"), (g.phase = 0)));
        else if (g.state === "return") {
          g.phase += $;
          const Le = te(g.phase / 0.8, 0, 1);
          (g.position.set(
            G.wet[0] + (G.dry[0] - G.wet[0]) * Le,
            G.level + (Qe - G.level) * Le + Math.sin(Le * Math.PI) * 0.3,
            G.wet[1] + (G.dry[1] - G.wet[1]) * Le,
          ),
            Le === 1 && ((g.state = "rest"), (g.cooldown = 5)));
        } else g.position.set(G.dry[0], Qe, G.dry[1]);
        (R.position.copy(g.position),
          R.rotation.set(
            g.state === "jump" ? 0.1 : 0,
            Math.atan2(-G.out[0], -G.out[1]) + (g.state === "return" ? Math.PI : 0),
            0,
          ),
          R.scale.setScalar(g.state === "water" ? 0 : g.scale),
          R.updateMatrix(),
          z.setMatrixAt(F, R.matrix),
          g.state === "jump" && (R.scale.z *= 1 + Math.sin(te(g.phase / 0.68, 0, 1) * Math.PI) * 1.1),
          R.updateMatrix(),
          ce.setMatrixAt(F, R.matrix));
      }
      z.instanceMatrix.needsUpdate = ce.instanceMatrix.needsUpdate = !0;
      for (let F = 0; F < Ke.length; F++) {
        const g = Ke[F];
        g.life = Math.max(0, g.life - $);
        const G = 1 - g.life / 1.5;
        (R.position.set(g.x, g.y, g.z),
          R.rotation.set(0, 0, 0),
          R.scale.setScalar(g.life > 0 ? (G * 0.9 + 0.08) * Math.min(1, g.life / 0.25) : 0),
          R.updateMatrix(),
          lt.setMatrixAt(F, R.matrix));
      }
      return ((lt.instanceMatrix.needsUpdate = !0), !0);
    }
    return (
      Mt(0, 0),
      {
        group: A,
        sky: h,
        fishers: c,
        frogs: V,
        refreshBanks: _t,
        update: Mt,
        getState: () => ({
          birds: b.length,
          herons: 2,
          cormorants: 3,
          sites: S.length,
          frogs: V.map((st) => ({
            id: st.id,
            state: st.state,
            jumps: st.jumps,
            position: st.position.toArray(),
            dry: st.site.dry,
            wet: st.site.wet,
          })),
          drawCalls: b.length * 3 + c.length * 3 + 3,
        }),
      }
    );
  }),
  (globalThis.MoulinShore29 = function (t, n) {
    "use strict";
    const A = n.waterRegions,
      re = n.terrainData,
      R = re.base.slice(),
      he = A.map(($) => $.poly.map((U) => U.slice())),
      te = t.MathUtils.clamp,
      O = ($) => $.map((U) => U.slice()),
      T = ($) => (($ = te($, 0, 1)), $ * $ * (3 - 2 * $)),
      le = new t.Group();
    ((le.name = "Contour_de_berge_a_modifier"),
      (le.userData.editorHelper = !0),
      (le.userData.exportSkip = !0),
      (le.visible = !1),
      n.model.add(le));
    const X = new t.LineLoop(new t.BufferGeometry(), new t.LineBasicMaterial({ color: 16764533, depthTest: !1 }));
    ((X.renderOrder = 98), le.add(X));
    const a = new t.Points(
      new t.BufferGeometry(),
      new t.PointsMaterial({ color: 16772550, size: 5, sizeAttenuation: !1, depthTest: !1 }),
    );
    ((a.renderOrder = 99), le.add(a));
    let _e = 0,
      pe = null,
      q = null,
      v = !1,
      k = null,
      h = !1,
      b = 0;
    function p($, U, He) {
      let Ce = { d: 1 / 0, i: 0, t: 0, x: 0, z: 0 };
      for (let xe = 0; xe < He.length; xe++) {
        const H = He[xe],
          W = He[(xe + 1) % He.length],
          D = W[0] - H[0],
          De = W[1] - H[1],
          ke = te((($ - H[0]) * D + (U - H[1]) * De) / (D * D + De * De || 1), 0, 1),
          rt = H[0] + ke * D,
          $e = H[1] + ke * De,
          B = (rt - $) ** 2 + ($e - U) ** 2;
        B < Ce.d && (Ce = { d: B, i: xe, t: ke, x: rt, z: $e });
      }
      return ((Ce.d = Math.sqrt(Ce.d)), Ce);
    }
    function S($, U) {
      var Ce;
      const He = he[$][U];
      return ((Ce = n.locked) == null ? void 0 : Ce.call(n, He[0], He[1])) || !1;
    }
    function x() {
      const $ = pe || A[_e].poly,
        U = A[_e].level;
      (X.geometry.dispose(),
        (X.geometry = new t.BufferGeometry().setFromPoints($.map((He) => new t.Vector3(He[0], U + 0.14, He[1])))),
        a.geometry.dispose(),
        (a.geometry = new t.BufferGeometry().setFromPoints(
          $.filter((He, Ce) => !S(_e, Ce)).map((He) => new t.Vector3(He[0], U + 0.17, He[1])),
        )),
        (le.visible = v),
        k == null || k.state(h),
        n.markDirty());
    }
    function c($) {
      ((_e = te(Number($) || 0, 0, A.length - 1)), (pe = null), (q = null), (h = !1), x());
    }
    function P($) {
      ((v = !!$), v || ((pe = null), (q = null), (h = !1)), x());
    }
    function C($, U, He, Ce, xe = 8, H = A[$].poly) {
      const W = O(H),
        D = te(xe, 3, 18);
      for (let De = 0; De < W.length; De++) {
        if (S($, De)) continue;
        const ke = Math.hypot(W[De][0] - U[0], W[De][1] - U[1]),
          rt = 1 - T(ke / D);
        if (rt <= 0) continue;
        let $e = W[De][0] + He * rt,
          B = W[De][1] + Ce * rt,
          F = $e - he[$][De][0],
          g = B - he[$][De][1],
          G = Math.hypot(F, g);
        (G > 8 && (($e = he[$][De][0] + (F * 8) / G), (B = he[$][De][1] + (g * 8) / G)), (W[De] = [$e, B]));
      }
      return W;
    }
    function Ne($, U) {
      const He = $.ray.intersectPlane(new t.Plane(new t.Vector3(0, 1, 0), -A[_e].level), new t.Vector3());
      if (!He) return !1;
      const Ce = pe || A[_e].poly,
        xe = p(He.x, He.z, Ce);
      return xe.d > Math.max(2, U * 0.35)
        ? (k == null || k.notice("Attrape le trait dor\xE9 de la berge pour le d\xE9placer."), !1)
        : ((pe = O(Ce)), (q = { start: He.clone(), anchor: [xe.x, xe.z], source: O(Ce), radius: U }), !0);
    }
    function z($) {
      if (!q) return !1;
      const U = $.ray.intersectPlane(new t.Plane(new t.Vector3(0, 1, 0), -A[_e].level), new t.Vector3());
      return U
        ? ((pe = C(_e, q.anchor, U.x - q.start.x, U.z - q.start.z, q.radius, q.source)),
          (h = JSON.stringify(pe) !== JSON.stringify(A[_e].poly)),
          x(),
          !0)
        : !1;
    }
    function ce() {
      q = null;
    }
    function V() {
      return A.flatMap(($, U) =>
        JSON.stringify($.poly) === JSON.stringify(he[U]) ? [] : [{ name: $.name, points: O($.poly) }],
      );
    }
    const Me = ($, U, He) => (U[0] - $[0]) * (He[1] - $[1]) - (U[1] - $[1]) * (He[0] - $[0]);
    function je($, U, He, Ce) {
      return Me($, U, He) * Me($, U, Ce) < -1e-9 && Me(He, Ce, $) * Me(He, Ce, U) < -1e-9;
    }
    function lt($) {
      var Ce;
      if (!Array.isArray($) || $.length > A.length) throw Error("Contours des berges invalides.");
      const U = new Set(),
        He = he.map(O);
      for (const xe of $) {
        const H = A.findIndex((D) => D.name === xe.name);
        if (H < 0 || U.has(H) || !Array.isArray(xe.points) || xe.points.length !== he[H].length)
          throw Error("Cet \xE9tang ne correspond pas au jardin.");
        U.add(H);
        const W = xe.points;
        for (let D = 0; D < W.length; D++) {
          const De = W[D],
            ke = he[H][D];
          if (
            !Array.isArray(De) ||
            De.length !== 2 ||
            De.some((rt) => !Number.isFinite(rt)) ||
            Math.hypot(De[0] - ke[0], De[1] - ke[1]) > 8.001
          )
            throw Error("Une berge peut se d\xE9placer de 8 m autour de son contour initial.");
          if (S(H, D) && Math.hypot(De[0] - ke[0], De[1] - ke[1]) > 0.001)
            throw Error("Les passages des ponts et les arriv\xE9es du bief restent en place.");
          if (Math.hypot(De[0] - ke[0], De[1] - ke[1]) > 0.001 && (Ce = n.locked) != null && Ce.call(n, De[0], De[1]))
            throw Error("Laisse un peu de place autour des b\xE2timents, ponts et canaux.");
        }
        for (let D = 0; D < W.length; D++)
          for (let De = D + 2; De < W.length; De++)
            if (!(D === 0 && De === W.length - 1) && je(W[D], W[(D + 1) % W.length], W[De], W[(De + 1) % W.length]))
              throw Error("Ce contour se croise. D\xE9place moins la berge ou \xE9largis le rayon.");
        He[H] = O(W);
      }
      for (const xe of U) {
        const H = He[xe];
        for (let W = 0; W < He.length; W++)
          if (W !== xe) {
            for (let D = 0; D < H.length; D++)
              for (let De = 0; De < He[W].length; De++)
                if (je(H[D], H[(D + 1) % H.length], He[W][De], He[W][(De + 1) % He[W].length]))
                  throw Error("Les \xE9tangs doivent garder des berges s\xE9par\xE9es.");
          }
        for (const W of n.islands || [])
          if (n.inside(W[0], he[xe]) && W.some((D) => !n.inside(D, H)))
            throw Error("Conserve l\u2019eau autour de l\u2019\xEEle.");
      }
      return He;
    }
    function Ke($) {
      const U = A[$],
        He = n.waterMeshes.find((D) => D.name === U.name);
      if (!He) return;
      const Ce = new t.ShapeGeometry(new t.Shape(U.poly.map((D) => new t.Vector2(D[0], -D[1]))));
      Ce.setAttribute("flow", new t.Float32BufferAttribute(new Float32Array(Ce.attributes.position.count * 2), 2));
      const xe = [],
        H = n.atlasBounds,
        W = Ce.attributes.position;
      for (let D = 0; D < W.count; D++)
        xe.push((W.getX(D) - H[0]) / (H[1] - H[0]), (-W.getY(D) - H[2]) / (H[3] - H[2]));
      (Ce.setAttribute("uv", new t.Float32BufferAttribute(xe, 2)),
        Math.abs(He.rotation.x) < 0.01 && Ce.rotateX(-Math.PI / 2),
        Ce.computeBoundingSphere(),
        He.geometry.dispose(),
        (He.geometry = Ce));
    }
    function ve($) {
      var H, W, D;
      const U = lt($);
      if (U.every((De, ke) => JSON.stringify(De) === JSON.stringify(A[ke].poly))) return !1;
      const Ce = U.map((De, ke) => {
          const rt = De.map((B, F) => (Math.hypot(B[0] - he[ke][F][0], B[1] - he[ke][F][1]) > 1e-4 ? F : -1)).filter(
            (B) => B >= 0,
          );
          if (!rt.length) return null;
          const $e = rt.flatMap((B) => [De[B], he[ke][B]]);
          return {
            index: ke,
            x0: Math.min(...$e.map((B) => B[0])) - 14,
            x1: Math.max(...$e.map((B) => B[0])) + 14,
            z0: Math.min(...$e.map((B) => B[1])) - 14,
            z1: Math.max(...$e.map((B) => B[1])) + 14,
          };
        }).filter(Boolean),
        xe = new Float32Array(re.base.length / 3);
      for (let De = 0; De < xe.length; De++) xe[De] = re.values[De * 3 + 1] - re.base[De * 3 + 1];
      re.base.set(R);
      for (let De = 0; De < xe.length; De++) {
        const ke = re.base[De * 3],
          rt = re.base[De * 3 + 2];
        for (const $e of Ce) {
          if (ke < $e.x0 || ke > $e.x1 || rt < $e.z0 || rt > $e.z1 || ((H = n.locked) != null && H.call(n, ke, rt)))
            continue;
          const B = $e.index,
            F = p(ke, rt, U[B]);
          if (F.d >= 12) continue;
          const g = he[B][F.i],
            G = he[B][(F.i + 1) % U[B].length],
            Qe = g[0] + (G[0] - g[0]) * F.t,
            Fe = g[1] + (G[1] - g[1]) * F.t,
            Le = 1 - T((F.d - 1) / 11),
            pt = F.x - Qe,
            Ge = F.z - Fe;
          if (Math.hypot(pt, Ge) < 1e-4) continue;
          const m = A[B].level,
            at = n.inside([ke, rt], U[B]);
          let ft = n.terrainHeight(ke - pt * Le, rt - Ge * Le, R);
          (at
            ? (ft = Math.min(ft, m - 0.1 - Math.min(1.5, F.d * 0.25)))
            : (n.inside([ke, rt], he[B]) || F.d < 1) && (ft = Math.max(ft, m + 0.1 + Math.min(0.5, F.d * 0.22))),
            (re.base[De * 3 + 1] = ft));
        }
      }
      for (const [De, ke, rt, $e] of re.constraints || [])
        re.base[De * 3 + 1] = re.base[ke * 3 + 1] * (1 - $e) + re.base[rt * 3 + 1] * $e;
      for (let De = 0; De < xe.length; De++)
        re.values[De * 3 + 1] = re.mesh.geometry.attributes.position.array[De * 3 + 1] = re.base[De * 3 + 1] + xe[De];
      for (let De = 0; De < U.length; De++) ((A[De].poly = U[De]), Ke(De));
      return (
        b++,
        (W = n.refreshDepth) == null || W.call(n, Ce, A, he, p),
        (D = n.rebuildRims) == null || D.call(n),
        (re.mesh.geometry.attributes.position.needsUpdate = !0),
        (pe = null),
        (h = !1),
        x(),
        !0
      );
    }
    function qe() {
      return [...V().filter(($) => $.name !== A[_e].name), { name: A[_e].name, points: O(pe || A[_e].poly) }];
    }
    function Xe() {
      if (!h) return !1;
      try {
        const $ = qe();
        return (
          lt($),
          k.apply($),
          (h = !1),
          (pe = null),
          x(),
          k.notice("Berge remodel\xE9e. Le relief, l\u2019eau et les passages ont \xE9t\xE9 mis \xE0 jour."),
          !0
        );
      } catch ($) {
        return (k == null || k.notice($.message, !0), !1);
      }
    }
    function _t() {
      ((pe = null), (q = null), (h = !1), x());
    }
    function Mt() {
      ((pe = O(he[_e])), (h = JSON.stringify(pe) !== JSON.stringify(A[_e].poly)), x());
    }
    function st() {
      const $ = A[_e].poly,
        U = $.reduce((Ce, xe) => [Ce[0] + xe[0] / $.length, Ce[1] + xe[1] / $.length], [0, 0]),
        He = Math.max(...$.map((Ce) => Math.hypot(Ce[0] - U[0], Ce[1] - U[1])));
      (n.controls.target.set(U[0], A[_e].level, U[1]),
        n.camera.position.set(U[0], Math.max(20, He * 1.5), U[1] + Math.max(8, He * 0.5)),
        n.controls.update(),
        n.markDirty());
    }
    return {
      regions: A,
      helper: le,
      select: c,
      setActive: P,
      pointerDown: Ne,
      pointerMove: z,
      endDrag: ce,
      exportContours: V,
      importContours: ve,
      validate: lt,
      deform: C,
      apply: Xe,
      cancel: _t,
      reset: Mt,
      focus: st,
      attachUI($) {
        ((k = $), x());
      },
      get revision() {
        return b;
      },
      getState: () => ({ revision: b, selected: _e, active: v, changed: h, dragging: !!q, contours: V() }),
    };
  }),
  (globalThis.MoulinGameUI22 = function (t) {
    "use strict";
    const { root: n, camera: A, bounds: re } = t,
      R = n.ownerDocument,
      he = (G, Qe, Fe) => Math.max(Qe, Math.min(Fe, G)),
      te = [],
      O = (G, Qe, Fe) => {
        (G == null || G.addEventListener(Qe, Fe), te.push(() => (G == null ? void 0 : G.removeEventListener(Qe, Fe))));
      };
    n.classList.add("game22");
    let T = !1,
      le = 0,
      X = "",
      a = -1 / 0,
      _e = -1 / 0,
      pe = "",
      q = [],
      v = !0,
      k = !1,
      h = "";
    const b = { baseDraws: 0, markerDraws: 0, paths: 0, visible: !1, expanded: !1 };
    function p() {
      const G = n.dataset.mode || "orbit";
      G !== X &&
        ((X = G),
        (n.dataset.ui22Guides = "visible"),
        clearTimeout(le),
        (le = setTimeout(() => {
          n.dataset.ui22Guides = "hidden";
        }, 5800)),
        (a = -1 / 0));
    }
    const S = new MutationObserver(p);
    (S.observe(n, { attributes: !0, attributeFilter: ["data-mode"] }), p());
    const x = n.querySelector("[data-ui-settings]"),
      c = () => {
        n.dataset.ui22SettingsOpen = String((x == null ? void 0 : x.getAttribute("aria-expanded")) === "true");
      },
      P = new MutationObserver(c);
    (x && P.observe(x, { attributes: !0, attributeFilter: ["aria-expanded"] }), c());
    const C = R.createElement("section");
    ((C.className = "game22-minimap"),
      (C.hidden = !0),
      C.setAttribute("aria-label", "Carte des alentours"),
      (C.innerHTML =
        '<div class="game22-map-heading"><span>LES JARDINS</span><span class="game22-map-north" aria-label="Nord en haut">N <svg viewBox="0 0 12 15" aria-hidden="true"><path d="M6 1 11 13 6 10 1 13Z"/></svg></span></div><button class="game22-map-toggle" type="button" aria-label="Afficher toute la propri\xE9t\xE9 sur la carte" aria-pressed="false"><canvas width="352" height="352" aria-hidden="true"></canvas><span class="game22-map-expand" aria-hidden="true">\u2922</span></button><div class="game22-map-footer"><span data-map-mode22>\xC0 pied</span><span class="game22-map-scale"><i></i><span data-map-scale22>20 m</span></span></div>'),
      n.appendChild(C));
    const Ne = C.querySelector("canvas"),
      z = Ne.getContext("2d", { alpha: !1 }),
      ce = R.createElement("canvas"),
      V = ce.getContext("2d", { alpha: !1 }),
      Me = C.querySelector("button"),
      je = C.querySelector("[data-map-mode22]"),
      lt = C.querySelector("[data-map-scale22]"),
      Ke = C.querySelector(".game22-map-scale i");
    ce.width = ce.height = 1024;
    const ve = Math.max(re.x1 - re.x0, re.z1 - re.z0) + 12,
      qe = (re.x0 + re.x1) * 0.5,
      Xe = (re.z0 + re.z1) * 0.5,
      _t = qe - ve * 0.5,
      Mt = Xe - ve * 0.5,
      st = 1024 / ve,
      $ = A.position.clone(),
      U = (G) => (G - _t) * st,
      He = (G) => (G - Mt) * st;
    function Ce(G, Qe = !1) {
      if (!(G != null && G.length)) return !1;
      (V.beginPath(), V.moveTo(U(G[0][0]), He(G[0][1])));
      for (let Fe = 1; Fe < G.length; Fe++) V.lineTo(U(G[Fe][0]), He(G[Fe][1]));
      return (Qe && V.closePath(), !0);
    }
    function xe(G, Qe, Fe, Le = 0.5) {
      Ce(G, !0) && ((V.fillStyle = Qe), V.fill(), Fe && ((V.strokeStyle = Fe), (V.lineWidth = Le * st), V.stroke()));
    }
    function H(G, Qe, Fe) {
      Ce(G) && ((V.strokeStyle = Fe), (V.lineWidth = Qe * st), (V.lineCap = V.lineJoin = "round"), V.stroke());
    }
    function W(G) {
      const Qe = Math.cos(G.angle || 0),
        Fe = Math.sin(G.angle || 0);
      return [
        [G.u0, G.v0],
        [G.u1, G.v0],
        [G.u1, G.v1],
        [G.u0, G.v1],
      ].map(([Le, pt]) => [G.cx + Le * Qe + pt * Fe, G.cz - Le * Fe + pt * Qe]);
    }
    function D() {
      var G, Qe, Fe, Le, pt, Ge;
      if (V) {
        ((V.fillStyle = "#738c68"),
          V.fillRect(0, 0, 1024, 1024),
          xe(
            [
              [re.x0, re.z0],
              [re.x1, re.z0],
              [re.x1, re.z1],
              [re.x0, re.z1],
            ],
            "#8eaa7b",
            "#5d7457",
            1,
          ));
        for (const m of ((G = t.siteLayout) == null ? void 0 : G.lawns) || []) xe(m.poly, "#adc291");
        for (const m of t.waterRegions || []) xe(m.poly, "#65959d", "#4d7985", 0.7);
        for (const m of t.channels || []) {
          const at = m.line || m.points;
          if ((Qe = m.widths) != null && Qe.length)
            for (let ft = 1; ft < ((at == null ? void 0 : at.length) || 0); ft++)
              H([at[ft - 1], at[ft]], ((+m.widths[ft - 1] || m.width) + (+m.widths[ft] || m.width)) * 0.5, "#679aa4");
          else H(at, +m.width || 2, "#679aa4");
        }
        for (const m of t.islands || []) xe(m.poly || m, "#b2c590", "#617d62", 0.35);
        for (const m of [(Fe = t.siteLayout) == null ? void 0 : Fe.forecourt, t.patio, t.yard, t.pointGarden])
          Array.isArray(m) && xe(m, "#c9c3a9", "#a59d85", 0.3);
        for (let m = 0; m < (t.paths || []).length; m++) H(t.paths[m], m === 0 ? 4.6 : 3.4, "#c3b28e");
        for (const m of q)
          (H(m.points || m.line, (+m.width || 1.2) + 0.6, "#768569"),
            H(m.points || m.line, +m.width || 1.2, "#d9c79d"));
        for (const m of ((Le = t.siteLayout) == null ? void 0 : Le.hillWalls) || [])
          H(m.points, m.width || 0.5, "#727f77");
        for (const m of t.bridges || [])
          if (m.points) H(m.points, m.width || 1.5, "#aa845e");
          else if (m.centre || (Number.isFinite(m.x) && Number.isFinite(m.z))) {
            const at = m.angle || 0,
              ft = Math.cos(at),
              ue = Math.sin(at),
              se = m.length || 3,
              Ve = m.width || 1.5,
              vt = ((pt = m.centre) == null ? void 0 : pt[0]) ?? m.x,
              me = ((Ge = m.centre) == null ? void 0 : Ge[1]) ?? m.z;
            xe(
              [
                [-se / 2, -Ve / 2],
                [se / 2, -Ve / 2],
                [se / 2, Ve / 2],
                [-se / 2, Ve / 2],
              ].map(([Re, et]) => [vt + Re * ft + et * ue, me - Re * ue + et * ft]),
              "#aa845e",
              "#775c46",
              0.2,
            );
          }
        for (const m of t.foundationFootprints || []) xe(W(m), "#ded1b4", "#465763", 0.7);
        for (const m of t.foundationFootprints || []) {
          const at = W(m).reduce((ft, ue) => [ft[0] + ue[0] * 0.25, ft[1] + ue[1] * 0.25], [0, 0]);
          m.name === "Moulin" &&
            (V.save(),
            V.translate(U(at[0]), He(at[1])),
            (V.fillStyle = "#546671"),
            V.fillRect(-2, -2, 4, 4),
            V.restore());
        }
        (b.baseDraws++, (b.paths = q.length), (v = !1), (h = ""));
      }
    }
    function De() {
      var Qe, Fe;
      const G = typeof t.editor == "function" ? t.editor() : t.editor;
      return (
        ((Qe = G == null ? void 0 : G.getPaths) == null ? void 0 : Qe.call(G)) ||
        ((Fe = t.siteLayout) == null ? void 0 : Fe.trails) ||
        []
      );
    }
    function ke() {
      const G = De(),
        Qe = JSON.stringify(G.map((Fe) => [Fe.id || Fe.name, Fe.width, Fe.points || Fe.line]));
      Qe !== pe && ((pe = Qe), (q = G), (v = !0));
    }
    function rt(G) {
      var Qe;
      return (
        (k = !!G),
        (b.expanded = k),
        Me.setAttribute("aria-pressed", String(k)),
        Me.setAttribute(
          "aria-label",
          k ? "Revenir \xE0 la carte des alentours" : "Afficher toute la propri\xE9t\xE9 sur la carte",
        ),
        C.classList.toggle("is-overview", k),
        (h = ""),
        (a = -1 / 0),
        (Qe = t.markDirty) == null || Qe.call(t),
        k
      );
    }
    (O(Me, "click", () => rt(!k)),
      O(R.defaultView, "resize", () => {
        ((h = ""), (a = -1 / 0));
      }));
    function $e(G, Qe) {
      var kt;
      if (!z || !V) return;
      const Fe = ((kt = G.getAudioState) == null ? void 0 : kt.call(G)) || {},
        Le = Fe.position || G.position;
      if (!Le || !Number.isFinite(Le.x) || !Number.isFinite(Le.z)) return;
      A.getWorldDirection($);
      const pt = Math.atan2($.x, -$.z),
        Ge = Ne.width,
        m = k ? ve : 132,
        at = m * st,
        ft = U(Le.x),
        ue = He(Le.z),
        se = k ? 0 : he(ft - at * 0.5, 0, 1024 - at),
        Ve = k ? 0 : he(ue - at * 0.5, 0, 1024 - at),
        vt = [Math.round(ft * 5), Math.round(ue * 5), Math.round(pt * 200), k, !!Fe.vehicle].join(":");
      if (((a = Qe), vt === h)) return;
      ((h = vt), z.drawImage(ce, se, Ve, at, at, 0, 0, Ge, Ge));
      const me = ((ft - se) / at) * Ge,
        Re = ((ue - Ve) / at) * Ge;
      (z.save(),
        z.translate(he(me, 10, Ge - 10), he(Re, 10, Ge - 10)),
        z.rotate(pt),
        z.beginPath(),
        z.moveTo(0, 0),
        z.arc(0, 0, 30, -Math.PI * 0.5 - 0.47, -Math.PI * 0.5 + 0.47),
        z.closePath(),
        (z.fillStyle = "#fff4c52e"),
        z.fill(),
        (z.strokeStyle = "#fff1c470"),
        (z.lineWidth = 1),
        z.stroke(),
        (z.shadowColor = "#20302b88"),
        (z.shadowBlur = 5),
        z.beginPath(),
        z.moveTo(0, -10),
        z.lineTo(6.5, 7),
        z.lineTo(0, 4),
        z.lineTo(-6.5, 7),
        z.closePath(),
        (z.fillStyle = Fe.vehicle ? "#e7ba78" : "#fff3d3"),
        z.fill(),
        (z.lineWidth = 2.5),
        (z.strokeStyle = "#344c55"),
        z.stroke(),
        z.restore(),
        (je.textContent = k
          ? "La propri\xE9t\xE9"
          : Fe.vehicle
            ? Fe.vehicle === "car"
              ? "En voiture"
              : "En quad"
            : "\xC0 pied"));
      const et = k ? 50 : 20;
      ((lt.textContent = et + " m"),
        (Ke.style.width = (et / m) * (Ne.clientWidth || 176) + "px"),
        b.markerDraws++,
        (a = Qe));
    }
    function B(G, Qe) {
      if (T) return !1;
      const Fe = Number.isFinite(G) ? G : performance.now() * 0.001,
        Le = typeof t.player == "function" ? t.player() : t.player,
        pt = n.dataset.mode === "play" && !!(Le != null && Le.enabled);
      return (
        (C.hidden = !pt),
        (b.visible = pt),
        !pt ||
          R.hidden ||
          ((Fe - _e > 0.8 || _e === -1 / 0) && ((_e = Fe), ke()), v && D(), Fe - a >= 0.066 && $e(Le, Fe)),
        !1
      );
    }
    function F() {
      ((v = !0), (_e = -1 / 0), (a = -1 / 0));
    }
    function g() {
      ((T = !0),
        clearTimeout(le),
        S.disconnect(),
        P.disconnect(),
        te.forEach((G) => G()),
        C.remove(),
        (ce.width = ce.height = 1));
    }
    return {
      update: B,
      invalidateMap: F,
      setMapExpanded: rt,
      dispose: g,
      stats: b,
      get mapExpanded() {
        return k;
      },
      get panel() {
        return C;
      },
    };
  }),
  (globalThis.MoulinNight22 = function (t, n) {
    "use strict";
    var E, Y;
    const {
        root: A,
        mount: re,
        scene: R,
        model: he,
        camera: te,
        renderer: O,
        sun: T,
        hemi: le,
        fill: X,
        mobile: a,
      } = n,
      _e = [];
    (E = he.getObjectByName("Garage_portes_ouvertes")) == null ||
      E.traverse((w) => {
        w.name === "Vantail_garage_ouvert" && _e.push({ object: w, dayAngle: w.rotation.y });
      });
    const pe = "moulin-night-v22",
      q = (w, be, ne) => Math.max(be, Math.min(ne, w)),
      v = () => (typeof n.weather == "function" ? n.weather() : n.weather),
      k = new Set(),
      h = new Map(),
      b = new Map(),
      p = new Set(),
      S = [],
      x = {
        unlitGain: { value: 1 },
        waterGain: { value: 1 },
        beamOn: { value: 0 },
        beamPosition: { value: new t.Vector3() },
        beamDirection: { value: new t.Vector3(0, 0, -1) },
        beamCone: { value: new t.Vector2(Math.cos(0.46), Math.cos(0.29)) },
      };
    let c = "day",
      P = !1,
      C = !1,
      Ne = !1,
      houseLights32 = !0,
      z = 0,
      ce = -1 / 0,
      V = "",
      Me = !1,
      je = !0,
      lt = "",
      Ke = new t.Vector3(1 / 0, 0, 0),
      ve = new t.Vector3(),
      qe = null;
    const Xe = new t.Vector3(),
      _t = new t.Vector3(),
      Mt = new t.Vector3(0, 1, 0),
      st = new t.Vector3(),
      $ = new t.Quaternion(),
      U = new t.Vector3(),
      He = [new t.Vector3(), new t.Vector3()],
      Ce = new t.Group();
    ((Ce.name = "Lumieres_portatives_v22"), (Ce.userData.exportSkip = !0), (Ce.userData.night22 = !0), R.add(Ce));
    function xe(w, be, ne, K, fe) {
      const Ee = new t.SpotLight(be, 0, ne, K, fe, 1.35);
      return (
        (Ee.name = w),
        (Ee.visible = !1),
        (Ee.castShadow = !1),
        Ee.shadow.mapSize.set(a ? 512 : 1024, a ? 512 : 1024),
        (Ee.shadow.camera.near = 0.12),
        (Ee.shadow.camera.far = ne),
        (Ee.shadow.bias = -5e-5),
        (Ee.shadow.normalBias = 0.025),
        (Ee.shadow.radius = 1.2),
        (Ee.userData.night22 = !0),
        Ce.add(Ee, Ee.target),
        k.add(Ee),
        Ee
      );
    }
    const H = xe("Torche_faisceau_principal", 16774629, 88, 0.37, 0.4),
      W = xe("Torche_lumiere_peripherique", 16773081, 36, 0.76, 0.9),
      D = [xe("Phare_quad_gauche", 16774367, 72, 0.36, 0.36), xe("Phare_quad_droit", 16774367, 72, 0.36, 0.36)],
      De = [],
      ke = [],
      rt = new Set(),
      $e = new Set();
    he.traverse((w) => {
      var be;
      (w.name === "Vitrage" && w.material && $e.add(w.material),
        (be = w.material) != null && be.userData.architectureGlow24 && !ke.includes(w.material) && ke.push(w.material));
    });
    function B(w, be, ne, K) {
      const fe = new t.PointLight(16760694, 0, K, 1.7);
      return (
        (fe.name = w),
        fe.position.copy(be),
        (fe.userData.night22 = !0),
        (fe.userData.nightPower23 = ne),
        (fe.castShadow = !1),
        Ce.add(fe),
        k.add(fe),
        De.push(fe),
        fe
      );
    }
    const F = he.getObjectByName("Moulin");
    if (F) {
      let ne = function (K, fe, Ee, bt) {
        const mt = new t.BoxGeometry(...fe);
        rt.add(mt);
        const Ct = new t.Mesh(mt, bt);
        (Ct.position.set(...Ee), (Ct.userData.night22 = !0), K.add(Ct));
      };
      F.updateWorldMatrix(!0, !1);
      for (const [K, fe, Ee, bt] of [
        ["Lumiere_terrasse_du_moulin", [-0.4, 2.45, 8.45], 2.35, 17],
        ["Lumiere_entree_du_moulin", [-5.22, 2.4, 0.1], 1.9, 14],
      ])
        B(K, F.localToWorld(new t.Vector3(...fe)), Ee, bt);
      const w = new t.MeshStandardMaterial({ color: 3623747, roughness: 0.8, metalness: 0.14 }),
        be = new t.MeshStandardMaterial({ color: 16767664, emissive: 16758366, emissiveIntensity: 0, roughness: 0.35 });
      if (((w.userData.night22 = be.userData.night22 = !0), ke.push(w, be), !F.userData.lanterns24))
        for (const [K, fe] of [
          [[-0.35, 2.48, 7.3], 0],
          [[-4.38, 2.5, 0.78], -Math.PI / 2],
        ]) {
          const Ee = new t.Group();
          ((Ee.name = "Lanterne_murale_du_moulin_v23"),
            (Ee.userData.night22 = !0),
            (Ee.userData.exportSkip = !0),
            Ee.position.copy(F.localToWorld(new t.Vector3(...K))),
            (Ee.rotation.y = F.rotation.y + fe),
            Ce.add(Ee),
            ne(Ee, [0.16, 0.5, 0.08], [0, 0.1, -0.04], w),
            ne(Ee, [0.065, 0.08, 0.31], [0, 0.27, 0.12], w),
            ne(Ee, [0.22, 0.32, 0.2], [0, 0, 0.2], be));
          for (const bt of [-0.13, 0.13]) for (const mt of [0.08, 0.32]) ne(Ee, [0.027, 0.39, 0.027], [bt, 0, mt], w);
          (ne(Ee, [0.34, 0.06, 0.34], [0, 0.2, 0.2], w), ne(Ee, [0.3, 0.05, 0.3], [0, -0.21, 0.2], w));
        }
    }
    const g = new t.CylinderGeometry(0.006, 1, 1, a ? 14 : 22, 10, !0);
    g.translate(0, -0.5, 0);
    const G = new t.ShaderMaterial({
      transparent: !0,
      depthWrite: !1,
      depthTest: !0,
      blending: t.AdditiveBlending,
      side: t.FrontSide,
      uniforms: { uTime: { value: 0 }, uGain: { value: 1 } },
      vertexShader:
        "varying float vAlong;varying vec3 vWorld,vNormal;void main(){vAlong=-position.y;vec4 world=modelMatrix*vec4(position,1.0);vWorld=world.xyz;vNormal=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*world;}",
      fragmentShader:
        "uniform float uTime,uGain;varying float vAlong;varying vec3 vWorld,vNormal;void main(){vec3 view=normalize(cameraPosition-vWorld);float edge=pow(abs(dot(normalize(vNormal),view)),.60);float lengthFade=smoothstep(.0,.065,vAlong)*(1.0-smoothstep(.12,1.0,vAlong));float dust=.87+.13*sin(vWorld.y*4.3+vWorld.x*1.5+uTime*.45);float alpha=edge*lengthFade*dust*.045*uGain;if(alpha<.0003)discard;gl_FragColor=vec4(vec3(1.0,.91,.72),alpha);}",
    });
    G.userData.night22 = !0;
    const Qe = [H, ...D].map((w, be) => {
        const ne = new t.Mesh(g, G);
        return (
          (ne.name = be ? "Faisceau_visible_phare_" + be : "Faisceau_visible_torche"),
          (ne.userData.night22 = !0),
          (ne.userData.exportSkip = !0),
          (ne.renderOrder = 8),
          (ne.frustumCulled = !1),
          (ne.visible = !1),
          Ce.add(ne),
          ne
        );
      }),
      Fe = new t.Vector3(0, -1, 0),
      Le = new t.Vector3(),
      pt = a ? 480 : 960,
      Ge = new Float32Array(pt * 3),
      m = new Float32Array(pt * 3);
    let at = 224731;
    const ft = () => ((at = (Math.imul(at, 1664525) + 1013904223) >>> 0), at / 4294967296);
    for (let w = 0; w < pt; w++) {
      const be = 0.035 + ft() * 0.96,
        ne = ft() * Math.PI * 2,
        K = Math.sqrt(1 - be * be),
        fe = 0.58 + ft() * 0.42;
      (Ge.set([Math.cos(ne) * K * 900, be * 900, Math.sin(ne) * K * 900], w * 3),
        m.set([fe, fe * (0.92 + ft() * 0.08), fe * (0.84 + ft() * 0.16)], w * 3));
    }
    const ue = new t.BufferGeometry();
    (ue.setAttribute("position", new t.BufferAttribute(Ge, 3)), ue.setAttribute("color", new t.BufferAttribute(m, 3)));
    const se = new t.PointsMaterial({
      color: 16777215,
      vertexColors: !0,
      size: a ? 1.35 : 1.65,
      sizeAttenuation: !1,
      transparent: !0,
      depthWrite: !1,
      fog: !1,
      toneMapped: !1,
    });
    ((se.userData.night22 = !0),
      (se.onBeforeCompile = (w) => {
        w.fragmentShader = w.fragmentShader.replace(
          "void main() {",
          `void main() {
if(length(gl_PointCoord-vec2(.5))>.5)discard;`,
        );
      }));
    const Ve = new t.Points(ue, se);
    ((Ve.name = "Etoiles_v22"),
      (Ve.renderOrder = -990),
      (Ve.frustumCulled = !1),
      (Ve.visible = !1),
      (Ve.userData.night22 = !0),
      Ce.add(Ve));
    const vt = `
 uniform float moulinUnlitGain22,moulinWaterGain22,moulinBeamOn22;
 uniform vec3 moulinBeamPosition22,moulinBeamDirection22;
 uniform vec2 moulinBeamCone22;
 float moulinWaterBeam22(vec3 p){vec3 d=p-moulinBeamPosition22;float distanceToLamp=length(d);float a=dot(d/max(.001,distanceToLamp),moulinBeamDirection22);return smoothstep(moulinBeamCone22.x,moulinBeamCone22.y,a)*pow(max(0.,1.-distanceToLamp/88.),1.35)*moulinBeamOn22;}
 `;
    function me(w, be) {
      const ne = w.indexOf("void main");
      if (ne < 0) return w;
      const K = w.indexOf("{", ne);
      let fe = 1,
        Ee = K + 1;
      for (; Ee < w.length && fe; ) (w[Ee] === "{" ? fe++ : w[Ee] === "}" && fe--, Ee++);
      return (
        w.slice(0, Ee - 1) +
        `
` +
        be +
        `
` +
        w.slice(Ee - 1)
      );
    }
    function Re(w, be) {
      var Ee;
      if (w.userData.night22Patched) return;
      w.userData.night22Patched = !0;
      const ne = w.onBeforeCompile,
        K = (Ee = w.customProgramCacheKey) == null ? void 0 : Ee.bind(w),
        fe = K ? K() : "";
      ((w.onBeforeCompile = (bt) => {
        (ne == null || ne(bt),
          (bt.uniforms.moulinUnlitGain22 = x.unlitGain),
          (bt.uniforms.moulinWaterGain22 = x.waterGain),
          (bt.uniforms.moulinBeamOn22 = x.beamOn),
          (bt.uniforms.moulinBeamPosition22 = x.beamPosition),
          (bt.uniforms.moulinBeamDirection22 = x.beamDirection),
          (bt.uniforms.moulinBeamCone22 = x.beamCone),
          (bt.fragmentShader =
            (be
              ? vt
              : `uniform float moulinUnlitGain22;
`) + bt.fragmentShader));
        const mt = be
          ? "float lamp22=moulinWaterBeam22(waterWorld);gl_FragColor.rgb*=moulinWaterGain22+lamp22*1.05;gl_FragColor.rgb+=vec3(.078,.075,.054)*lamp22;"
          : "gl_FragColor.rgb*=moulinUnlitGain22;";
        bt.fragmentShader.includes("#include <tonemapping_fragment>")
          ? (bt.fragmentShader = bt.fragmentShader.replace(
              "#include <tonemapping_fragment>",
              mt +
                `
#include <tonemapping_fragment>`,
            ))
          : (bt.fragmentShader = me(bt.fragmentShader, mt));
      }),
        (w.customProgramCacheKey = () => fe + "|moulin-night22|" + (be ? "water" : "unlit")),
        (w.needsUpdate = !0));
    }
    function et() {
      (R.traverse((w) => {
        var be, ne, K, fe, Ee, bt, mt, Ct, Pt, jt;
        if (
          w.isMesh &&
          w.visible &&
          !w.castShadow &&
          !((be = w.userData) != null && be.renderTile) &&
          !((ne = w.userData) != null && ne.isWater) &&
          !((K = w.material) != null && K.transparent) &&
          /Details_groupes|Mur|Moulin|Dependance|Fa[cç]ade/i.test(w.name) &&
          (fe = w.geometry) != null &&
          fe.attributes.position
        ) {
          w.geometry.boundingBox || w.geometry.computeBoundingBox();
          const Dt = w.geometry.boundingBox;
          Dt && Dt.max.y - Dt.min.y > 0.36 && p.add(w);
        }
        if (
          (w.isLight && !k.has(w) && !b.has(w) && b.set(w, { intensity: w.intensity, castShadow: w.castShadow }),
          !(((Ee = w.userData) != null && Ee.editorHelper) || ((bt = w.userData) != null && bt.night22)))
        )
          for (const Dt of Array.isArray(w.material) ? w.material : [w.material]) {
            if (!Dt || ((mt = Dt.userData) != null && mt.night22) || h.has(Dt)) continue;
            let we = w,
              We = !1;
            for (; we; ) {
              if (((Ct = we.userData) != null && Ct.editorHelper) || we.name === "Reperes_editeur") {
                We = !0;
                break;
              }
              we = we.parent;
            }
            We ||
              (h.set(Dt, { emissiveIntensity: Dt.emissiveIntensity, envMapIntensity: Dt.envMapIntensity }),
              Dt.isMeshStandardMaterial ||
                Dt.isMeshLambertMaterial ||
                Dt.isMeshPhongMaterial ||
                Dt.isMeshToonMaterial ||
                Re(
                  Dt,
                  !!((Pt = w.userData) != null && Pt.isWater) &&
                    ((jt = Dt.fragmentShader) == null ? void 0 : jt.includes("waterWorld")),
                ));
          }
      }),
        (ce = z),
        kt());
    }
    function kt() {
      for (const be of p) be.castShadow = c !== "day";
      const w = c === "black";
      for (const [be, ne] of h)
        (ne.envMapIntensity !== void 0 && (be.envMapIntensity = c === "day" ? ne.envMapIntensity : 0),
          ne.emissiveIntensity !== void 0 &&
            (be.emissiveIntensity = c === "day" ? ne.emissiveIntensity : Math.min(ne.emissiveIntensity || 0, 0.12)));
      for (const be of n.windows || []) be.emissiveIntensity = c === "day" || !houseLights32 || !$e.has(be) ? 0 : 0.82;
      for (const be of n.lampMats || []) be.emissiveIntensity = c === "day" ? 0.15 : houseLights32 ? 1.3 : 0.03;
      for (const be of ke) be.emissive && (be.emissiveIntensity = c === "day" || !houseLights32 ? 0 : 1.25);
    }
    function M() {
      var ne, K, fe, Ee;
      const w = v(),
        be = (w == null ? void 0 : w.uniforms) || {};
      return {
        mode: (w == null ? void 0 : w.mode) || "sun",
        snow: ((ne = be.snow) == null ? void 0 : ne.value) || 0,
        rain: ((K = be.rain) == null ? void 0 : K.value) || 0,
        wet: ((fe = be.wet) == null ? void 0 : fe.value) || 0,
        cover: ((Ee = be.cover) == null ? void 0 : Ee.value) || 0,
        night: c !== "day",
        nightMode: c,
      };
    }
    function ee(w = !1) {
      var Ee, bt, mt, Ct, Pt, jt;
      const be = v(),
        ne = M(),
        K = c + "|" + ne.mode + "|" + houseLights32;
      if (!w && K === V) return;
      V = K;
      const fe = ((Ee = be == null ? void 0 : be.modes) == null ? void 0 : Ee[ne.mode]) || {
        light: 2,
        ambient: 0.7,
        sky: "#abc6d6",
      };
      if (c === "day")
        ((le.intensity = fe.ambient),
          (T.intensity = fe.light),
          (X.intensity = ne.mode === "rain" ? 0.18 : 0.17),
          T.color.set(ne.mode === "sun" ? 16773858 : 14018554),
          (T.castShadow = !0),
          (O.toneMappingExposure = ne.mode === "snow" ? 0.92 : 1));
      else {
        const Dt = c === "black";
        ((le.intensity = Dt ? 0.028 : 0.055),
          (T.intensity = Dt ? 0.014 : 0.058),
          (X.intensity = Dt ? 0.005 : 0.008),
          T.color.set(9087700),
          (T.castShadow = !1),
          (O.toneMappingExposure = 0.95),
          R.background.set(Dt ? 132106 : 66314),
          R.fog && R.fog.color.set(Dt ? 132106 : 66314),
          (mt = (bt = be == null ? void 0 : be.uniforms) == null ? void 0 : bt.fogColor) == null ||
            mt.value.set(Dt ? 132106 : 66314));
      }
      be != null && be.sky && (be.sky.visible = c !== "black");
      for (const [Dt, we] of b) Dt !== T && Dt !== le && Dt !== X && (Dt.intensity = c === "day" ? we.intensity : 0);
      // V32 : lampes du moulin et du jardin eteintes apres 23 h 30 (voir setHouseLights).
      for (const Dt of n.lamps || []) Dt.intensity = c === "day" || !houseLights32 ? 0 : 2.2;
      for (const Dt of De)
        ((Dt.intensity = c === "day" || !houseLights32 ? 0 : Dt.userData.nightPower23), (Dt.visible = Dt.intensity > 0));
      for (const [Dt] of b) Dt.visible = Dt.intensity > 1e-5;
      ((n.waterDaylight.value = c === "day" ? 1 : c === "stars" ? 0.055 : 0.03),
        (Pt = (Ct = n.forest) == null ? void 0 : Ct.setDaylight) == null ||
          Pt.call(Ct, c === "day" ? 1 : c === "stars" ? 0.07 : 0.035),
        (x.unlitGain.value = c === "day" ? 1 : c === "stars" ? 0.11 : 0.065),
        (x.waterGain.value = c === "day" ? 1 : c === "stars" ? 0.22 : 0.16),
        kt(),
        (O.shadowMap.needsUpdate = !0),
        (jt = n.invalidate) == null || jt.call(n));
    }
    function ge() {
      try {
        localStorage.setItem(pe, JSON.stringify({ mode: c, torch: P }));
      } catch {}
    }
    function ae() {
      ((A.dataset.nightMode22 = c),
        (A.dataset.time = c === "day" ? "jour" : "soir"),
        A.querySelectorAll("[data-night-mode22]").forEach((w) => (w.value = c)),
        A.querySelectorAll("[data-light]").forEach((w) =>
          w.setAttribute("aria-pressed", String(w.dataset.light === (c === "day" ? "jour" : "soir"))),
        ),
        A.querySelectorAll("[data-torch22]").forEach((w) => {
          ((w.hidden = c === "day"),
            w.setAttribute("aria-hidden", String(c === "day")),
            (w.tabIndex = c === "day" ? -1 : 0),
            w.setAttribute("aria-pressed", String(P)),
            w.setAttribute("title", (P ? "\xC9teindre" : "Allumer") + " la lampe \xB7 F"));
          const be = w.querySelector("[data-torch22-label]");
          be && (be.textContent = P ? "Lampe allum\xE9e" : "Lampe");
        }));
    }
    function de(w, be = !0) {
      var ne, K, fe, Ee;
      ["day", "stars", "black"].includes(w) &&
        ((c = w),
        c === "day" && (P = !1),
        (K = (ne = v()) == null ? void 0 : ne.setNight) == null || K.call(ne, c !== "day"),
        ee(!0),
        ae(),
        (fe = n.onModeChange) == null || fe.call(n, c),
        be && ge(),
        (Ee = n.markDirty) == null || Ee.call(n));
    }
    function oe(w, be = !0) {
      var ne, K;
      ((P = !!w && c !== "day"),
        ae(),
        be && ge(),
        (je = !0),
        (ne = n.markDirty) == null || ne.call(n),
        (K = n.invalidate) == null || K.call(n));
    }
    const y = () => (c === "day" ? !1 : (oe(!P), !0));
    function I(w, be, ne) {
      (w.position.copy(be), w.target.position.copy(be).addScaledVector(ne, w.distance || 45));
    }
    function Be(w = 0, be = 0) {
      var Dt, we, We, yt, Ft, Bt, Rt, qt, Kt, ro, oo, uo;
      if (Me) return !1;
      z += Math.max(0, w);
      const ne = v(),
        K = M(),
        fe = typeof n.player == "function" ? n.player() : n.player,
        Ee = ((Dt = n.getMode) == null ? void 0 : Dt.call(n)) || A.dataset.mode || "orbit";
      ee();
      let bt = !1;
      for (const Tt of _e) {
        const Jt = c === "day" ? Tt.dayAngle : 0,
          io = Jt - Tt.object.rotation.y;
        Math.abs(io) > 4e-4
          ? ((Tt.object.rotation.y += io * (1 - Math.exp(-Math.max(0, w) * 3.4))), (bt = !0))
          : (Tt.object.rotation.y = Jt);
      }
      (bt && ((O.shadowMap.needsUpdate = !0), (we = n.invalidate) == null || we.call(n)),
        z - ce > 1.25 && et(),
        Ve.position.copy(te.position),
        (Ve.visible = c === "stars"),
        (se.opacity = 0.9 * (1 - K.rain * 0.985) * (1 - K.snow * 0.65) * q((1 - K.cover) * 1.45, 0.08, 1)));
      const mt =
        !!((We = fe == null ? void 0 : fe.getVehicleState) != null && We.call(fe).riding) &&
        !!(fe != null && fe.enabled) &&
        Ee === "play";
      ((Ne = c !== "day" && mt), (C = c !== "day" && P));
      const Ct =
        ((yt = fe == null ? void 0 : fe.getLightAnchors) == null ? void 0 : yt.call(fe)) ||
        ((Ft = fe == null ? void 0 : fe.getLightMounts) == null ? void 0 : Ft.call(fe));
      (te.getWorldDirection(Xe),
        Xe.normalize(),
        _t.crossVectors(Xe, Mt).normalize(),
        st.copy(te.position),
        Ee === "play" && fe != null && fe.enabled
          ? (Ct != null && Ct.head ? st.copy(Ct.head) : st.copy(fe.position).add(new t.Vector3(0, 1.5, 0)),
            st.addScaledVector(_t, 0.24),
            (st.y -= 0.09),
            (Xe.y = q(Xe.y * 0.4 + 0.035, -0.24, 0.2)),
            Xe.normalize())
          : st.addScaledVector(_t, 0.12),
        I(H, st, Xe),
        I(W, st, Xe),
        (H.intensity = C ? 8.6 : 0),
        (W.intensity = C ? 0.62 : 0));
      for (let Tt = 0; Tt < 2; Tt++) D[Tt].intensity = Ne ? 5.2 : 0;
      H.visible = W.visible = C;
      for (const Tt of D) Tt.visible = Ne;
      if (Ne) {
        const Tt = fe.vehicleChassis || ((Bt = fe.vehicleRoot) == null ? void 0 : Bt.children[0]);
        if (Tt) {
          (Tt.updateWorldMatrix(!0, !1), Tt.getWorldQuaternion($), U.set(0, -0.1, 1).applyQuaternion($).normalize());
          for (let Jt = 0; Jt < 2; Jt++)
            ((Rt = Ct == null ? void 0 : Ct.headlights) != null && Rt[Jt]
              ? He[Jt].copy(Ct.headlights[Jt])
              : (He[Jt].set(Jt === 0 ? -0.31 : 0.31, 0.722, 0.995), Tt.localToWorld(He[Jt])),
              I(D[Jt], He[Jt], U));
        }
      }
      ((G.uniforms.uTime.value = z), (G.uniforms.uGain.value = c === "day" ? 0.12 : 1));
      for (let Tt = 0; Tt < Qe.length; Tt++) {
        const Jt = [H, ...D][Tt],
          io = Qe[Tt];
        if (((io.visible = Jt.visible), !io.visible)) continue;
        const po = Tt === 0 ? 46 : 36;
        (Le.copy(Jt.target.position).sub(Jt.position).normalize(),
          io.position.copy(Jt.position),
          io.quaternion.setFromUnitVectors(Fe, Le),
          io.scale.set(Math.tan(Jt.angle) * po, po, Math.tan(Jt.angle) * po));
      }
      const Pt = C ? H : Ne ? D[0] : null;
      if (Pt !== qe) {
        for (const Tt of [H, ...D]) Tt.castShadow = Tt === Pt;
        ((qe = Pt), (je = !0), (O.shadowMap.needsUpdate = !0));
      }
      if (Pt) {
        const Tt = a || ((qt = n.getQuality) == null ? void 0 : qt.call(n)) === "fast" ? 512 : 1024;
        Pt.shadow.mapSize.x !== Tt &&
          (Pt.shadow.mapSize.set(Tt, Tt), (Kt = Pt.shadow.map) == null || Kt.dispose(), (Pt.shadow.map = null));
        const Jt = U.copy(Pt.target.position).sub(Pt.position).normalize();
        ((je || Pt.position.distanceToSquared(Ke) > 2e-5 || Jt.distanceToSquared(ve) > 6e-6) &&
          (Ke.copy(Pt.position),
          ve.copy(Jt),
          (O.shadowMap.needsUpdate = !0),
          (ro = n.invalidate) == null || ro.call(n)),
          x.beamPosition.value.copy(Pt.position),
          x.beamDirection.value.copy(Jt),
          x.beamCone.value.set(Math.cos(Pt.angle * 1.18), Math.cos(Pt.angle * (1 - Pt.penumbra))),
          (x.beamOn.value = c === "day" ? 0 : 1));
      } else x.beamOn.value = 0;
      ((je = !1),
        c === "black" &&
          (R.background.set(132106),
          R.fog && R.fog.color.set(132106),
          (uo = (oo = ne == null ? void 0 : ne.uniforms) == null ? void 0 : oo.fogColor) == null ||
            uo.value.set(132106)));
      const jt = lt !== K.mode + "|" + c;
      return ((lt = K.mode + "|" + c), bt || jt || !!Pt);
    }
    const Se = (w, be, ne, K) => {
      (w == null || w.addEventListener(be, ne, K),
        S.push(() => (w == null ? void 0 : w.removeEventListener(be, ne, K))));
    };
    let N = A.querySelector("[data-torch22]");
    (N ||
      ((N = document.createElement("button")),
      (N.type = "button"),
      (N.className = "btn game22-torch"),
      (N.dataset.torch22 = ""),
      N.setAttribute("aria-label", "Allumer ou \xE9teindre la lampe torche"),
      (N.innerHTML =
        '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M6 9h7l3-4v14l-3-4H6zM3 9v6M19 6l2-2m-2 8h3m-3 6 2 2"/></svg><span class="game19-action-label" data-torch22-label>Lampe</span>'),
      (Y = A.querySelector(".game19-actions")) == null || Y.prepend(N)),
      Se(N, "click", y),
      Se(document, "keydown", (w) => {
        var be, ne;
        c === "day" ||
          w.repeat ||
          w.ctrlKey ||
          w.metaKey ||
          w.altKey ||
          (w.code !== "KeyF" && ((be = w.key) == null ? void 0 : be.toLowerCase()) !== "f") ||
          ((ne = w.target) != null && ne.closest('input,textarea,select,[contenteditable="true"]')) ||
          (w.preventDefault(), y());
      }),
      A.querySelectorAll("[data-night-mode22]").forEach((w) => Se(w, "change", () => de(w.value))),
      et());
    try {
      const w = JSON.parse(localStorage.getItem(pe) || "{}");
      (["day", "stars", "black"].includes(w.mode) && (c = w.mode), (P = !!w.torch));
    } catch {}
    (de(c, !1), oe(P, !1), Be(0, 0));
    function Ie() {
      return {
        mode: c,
        garageClosed: _e.every((w) => Math.abs(w.object.rotation.y) < 0.008),
        garageAngles: _e.map((w) => w.object.rotation.y),
        torchEnabled: P,
        torchActive: C,
        headlightsActive: Ne,
        starsVisible: Ve.visible,
        starsCount: pt,
        shadowSpotlights: [H, ...D].filter((w) => w.castShadow).length,
        shadowSize: (qe == null ? void 0 : qe.shadow.mapSize.x) || 0,
        sunShadow: T.castShadow,
        ambient: le.intensity,
        daylight: n.waterDaylight.value,
        blackout: !1,
        ambientFraction: c === "black" ? 0.03 : null,
        beamDistance: H.distance,
        visibleBeams: Qe.filter((w) => w.visible).length,
        homeLights: De.filter((w) => w.visible).length + (n.lamps || []).filter((w) => w.visible).length,
        lights: { torch: H.intensity, spill: W.intensity, headlights: D.map((w) => w.intensity) },
        materials: h.size,
        nightOccluders: p.size,
        visibleSpots: [H, W, ...D].filter((w) => w.visible).length,
      };
    }
    return {
      group: Ce,
      torch: H,
      spill: W,
      headlights: D,
      stars: Ve,
      beams: Qe,
      fixedLights: De,
      uniforms: x,
      setMode: de,
      setTorch: oe,
      /** V32 : allume ou eteint les lumieres de la maison et du jardin (la nuit seulement). */
      setHouseLights(on) {
        ((on = !!on), on !== houseLights32 && ((houseLights32 = on), ee(!0)));
      },
      houseLights: () => houseLights32,
      toggleTorch: y,
      update: Be,
      refreshMaterials: et,
      getState: Ie,
      getWeatherState: M,
      shouldSkipReflection: () => {
        var w;
        return (
          c === "black" &&
          !C &&
          !Ne &&
          te.position.distanceToSquared(((w = he.getObjectByName("Moulin")) == null ? void 0 : w.position) || st) > 6400
        );
      },
      dispose() {
        var w, be;
        ((Me = !0),
          S.forEach((ne) => ne()),
          (w = Ce.parent) == null || w.remove(Ce),
          ue.dispose(),
          se.dispose(),
          g.dispose(),
          G.dispose());
        for (const ne of rt) ne.dispose();
        for (const ne of ke) ne.dispose();
        for (const ne of [H, W, ...D]) (be = ne.shadow.map) == null || be.dispose();
      },
    };
  }),
  (globalThis.MoulinTerrainPreview21 = function (t, n) {
    const A = new t.Group();
    ((A.name = "Apercu_relief_avant_application"),
      (A.userData.editorHelper = !0),
      (A.userData.exportSkip = !0),
      (A.visible = !1),
      n.parent.add(A));
    const re = new t.Mesh(
      new t.BufferGeometry(),
      new t.MeshBasicMaterial({
        vertexColors: !0,
        transparent: !0,
        opacity: 0.3,
        depthTest: !1,
        depthWrite: !1,
        toneMapped: !1,
        side: t.DoubleSide,
      }),
    );
    ((re.renderOrder = 87), A.add(re));
    const R = new t.LineSegments(
      new t.BufferGeometry(),
      new t.LineBasicMaterial({
        color: 15398365,
        transparent: !0,
        opacity: 0.8,
        depthTest: !1,
        depthWrite: !1,
        toneMapped: !1,
      }),
    );
    ((R.renderOrder = 88), A.add(R));
    const he = new t.Line(
      new t.BufferGeometry(),
      new t.LineBasicMaterial({ color: 13403416, depthTest: !1, depthWrite: !1, toneMapped: !1 }),
    );
    ((he.renderOrder = 90), A.add(he));
    const te = new t.SphereGeometry(0.28, 9, 5),
      O = [];
    for (const [pe, q] of [
      ["centre", 1475928],
      ["direction", 14517527],
      ["largeur", 2129866],
    ]) {
      const v = new t.Mesh(te, new t.MeshBasicMaterial({ color: q, depthTest: !1, depthWrite: !1, toneMapped: !1 }));
      ((v.name = "Poignee_relief_" + pe), (v.userData.terrainHandle21 = pe), (v.renderOrder = 94), A.add(v), O.push(v));
    }
    const T = new t.ArrowHelper(new t.Vector3(1, 0, 0), new t.Vector3(), 4, 14517527, 0.6, 0.35);
    ((T.line.material.toneMapped = T.cone.material.toneMapped = !1),
      (T.line.material.depthTest = T.cone.material.depthTest = !1),
      (T.line.material.depthWrite = T.cone.material.depthWrite = !1),
      (T.line.renderOrder = T.cone.renderOrder = 93),
      A.add(T));
    function le(pe, q) {
      (pe.geometry.dispose(), (pe.geometry = q));
    }
    function X(pe) {
      var $;
      const q = pe.options,
        v = Math.cos((q.angle * Math.PI) / 180),
        k = Math.sin((q.angle * Math.PI) / 180),
        h = Math.min(38, Math.max(6, Math.ceil(q.length / 0.65))),
        b = Math.min(32, Math.max(4, Math.ceil(q.width / 0.65))),
        p = [],
        S = [],
        x = [],
        c = [],
        P = (U, He) => [q.x + U * v - He * k, q.z + U * k + He * v],
        C = (U, He) => pe.heightAt(U, He);
      let Ne = 0,
        z = 0,
        ce = 1 / 0,
        V = -1 / 0;
      for (let U = 0; U <= b; U++)
        for (let He = 0; He <= h; He++) {
          const [Ce, xe] = P((He / h - 0.5) * q.length, (U / b - 0.5) * q.width),
            H = n.terrainHeight(Ce, xe),
            W = C(Ce, xe),
            D = W - H,
            ke = n.terrainAllowed(Ce, xe)
              ? D < -0.02
                ? [1, 0.47, 0.29]
                : D > 0.02
                  ? [0.36, 0.91, 0.6]
                  : [0.66, 0.79, 0.75]
              : [0.83, 0.25, 0.24];
          (p.push(Ce, W + 0.085, xe), S.push(...ke), (ce = Math.min(ce, D)), (V = Math.max(V, D)));
          const rt = (q.length * q.width) / (h * b);
          if (He < h && U < b) {
            D > 0 ? (z += D * rt) : (Ne -= D * rt);
            const $e = U * (h + 1) + He;
            x.push($e, $e + h + 1, $e + 1, $e + 1, $e + h + 1, $e + h + 2);
          }
        }
      const Me = new t.BufferGeometry();
      (Me.setAttribute("position", new t.Float32BufferAttribute(p, 3)),
        Me.setAttribute("color", new t.Float32BufferAttribute(S, 3)),
        Me.setIndex(x),
        le(re, Me));
      for (let U = 0; U <= b; U++)
        for (let He = 0; He <= h; He++) {
          const Ce = U * (h + 1) + He;
          for (const xe of [He < h ? Ce + 1 : -1, U < b ? Ce + h + 1 : -1])
            xe >= 0 && c.push(...p.slice(Ce * 3, Ce * 3 + 3), ...p.slice(xe * 3, xe * 3 + 3));
        }
      le(R, new t.BufferGeometry().setAttribute("position", new t.Float32BufferAttribute(c, 3)));
      const je = [];
      for (const [U, He] of [
        [-0.5, -0.5],
        [0.5, -0.5],
        [0.5, 0.5],
        [-0.5, 0.5],
        [-0.5, -0.5],
      ]) {
        const [Ce, xe] = P(U * q.length, He * q.width);
        je.push(new t.Vector3(Ce, C(Ce, xe) + 0.14, xe));
      }
      le(he, new t.BufferGeometry().setFromPoints(je));
      const lt = [
        [0, 0],
        [q.length * 0.5, 0],
        [0, q.width * 0.5],
      ];
      O.forEach((U, He) => {
        const [Ce, xe] = P(...lt[He]);
        U.position.set(Ce, C(Ce, xe) + 0.3, xe);
      });
      const [Ke, ve] = P(-q.length * 0.2, 0),
        [qe, Xe] = P(q.length * 0.36, 0),
        _t = new t.Vector3(Ke, C(Ke, ve) + 0.28, ve),
        Mt = new t.Vector3(qe, C(qe, Xe) + 0.28, Xe),
        st = Mt.sub(_t);
      return (
        T.position.copy(_t),
        T.setDirection(st.clone().normalize()),
        T.setLength(Math.max(0.1, st.length()), Math.min(0.7, q.length * 0.12), Math.min(0.42, q.width * 0.12)),
        (A.visible = !0),
        ($ = n.markDirty) == null || $.call(n),
        { cut: Math.round(Ne * 10) / 10, fill: Math.round(z * 10) / 10, min: ce, max: V }
      );
    }
    function a() {
      var pe;
      ((A.visible = !1), (pe = n.markDirty) == null || pe.call(n));
    }
    function _e(pe) {
      var q;
      return (
        (A.visible && ((q = pe.intersectObjects(O, !1)[0]) == null ? void 0 : q.object.userData.terrainHandle21)) ||
        null
      );
    }
    return { group: A, update: X, hide: a, pick: _e, handles: O };
  }),
  (globalThis.MoulinGarden25 = function (t, n) {
    const {
        world: A,
        model: re,
        architecture: R,
        terrainHeight: he,
        materials: te,
        surfaces: O,
        standard: T,
        forest: le,
        channels: X,
        wetAt: a,
        inside: _e,
      } = n,
      pe = new t.Group();
    ((pe.name = "Fond_du_jardin_bois_et_sentier_v25"), R.add(pe));
    const q = new t.BoxGeometry(1, 1, 1),
      v = new t.Object3D(),
      k = T("#81715a", { map: O.wood, roughness: 0.97 }),
      h = T("#685f4a", { map: O.wood, roughness: 1 }),
      b = T("#514c3b", { roughness: 1 }),
      p = T("#686b58", { map: O.stone, roughness: 0.92 }),
      S = T("#c5a37a", { roughness: 1 });
    function x(me, Re, et, kt = k, M = pe) {
      let ee = new t.Mesh(q, kt);
      return (
        (ee.name = me),
        ee.position.set(...Re),
        ee.scale.set(...et),
        (ee.castShadow = !0),
        (ee.receiveShadow = !0),
        M.add(ee),
        ee
      );
    }
    function c(me, Re, et, kt, M, ee, ge) {
      const ae = new t.Vector3(...Re),
        de = new t.Vector3(...et),
        oe = x(me, ae.clone().add(de).multiplyScalar(0.5).toArray(), [kt, ae.distanceTo(de), M], ee, ge);
      return (oe.quaternion.setFromUnitVectors(new t.Vector3(0, 1, 0), de.sub(ae).normalize()), oe);
    }
    const P = A.bridgeSurfaces.filter(
        (me) =>
          me.centre &&
          [
            "Petit_pont_du_bief",
            "Petit_pont_de_la_vanne_naturelle",
            "Passerelle_bout_du_grand_etang",
            "Passerelle_amont_du_petit_bassin",
          ].includes(me.name),
      ),
      C = [];
    for (const me of P) {
      const Re = Math.cos(me.angle),
        et = Math.sin(me.angle),
        kt = (M, ee) => [me.centre[0] + M * Re + ee * et, me.centre[1] - M * et + ee * Re];
      for (const M of [-1, 1]) {
        if (me.name === "Petit_pont_du_bief" && M === -1) continue;
        const ee = me.name === "Petit_pont_de_la_vanne_naturelle" && M === 1,
          ge = A.bridgeSurfaces.find((Ie) => Ie.name === "Acces_bois_jusqua_la_berge_de_la_vanne"),
          ae = M * (ee ? 3.55 : me.length * 0.5 - 0.03),
          de = ae + M * 2.5,
          oe = kt(de, 0),
          y = ee ? ge.endLevel : me.topLevel,
          I = he(...oe) + 0.055,
          Be = 16,
          Se = kt((ae + de) * 0.5, 0),
          N = {
            name: me.name + "_Rampe_" + M,
            centre: Se,
            angle: me.angle,
            length: Math.abs(de - ae),
            width: 2.65,
            startLevel: M > 0 ? y : I,
            endLevel: M > 0 ? I : y,
          };
        for (let Ie = 0; Ie < Be; Ie++) {
          const E = (Ie + 0.5) / Be,
            Y = ae + (de - ae) * E,
            w = kt(Y, 0),
            be = x(
              "Lattes_raccord_passerelle_v25",
              [w[0], t.MathUtils.lerp(y, I, E) - 0.055, w[1]],
              [Math.hypot((de - ae) / Be, (I - y) / Be) + 0.006, 0.11, 2.65],
              k,
            );
          ((be.rotation.y = me.angle), be.rotateZ(Math.atan2((I - y) * M, Math.abs(de - ae))));
        }
        (A.bridgeSurfaces.push(N), C.push(N));
      }
      if (/Passerelle_/.test(me.name))
        for (const M of [-1, 1])
          A.solidRects.push({
            name: me.name + "_Garde_corps_v25",
            cx: me.centre[0],
            cz: me.centre[1],
            angle: me.angle,
            u0: -me.length * 0.5 + 0.04,
            u1: me.length * 0.5 - 0.04,
            v0: M * 1.225 - 0.04,
            v1: M * 1.225 + 0.04,
            y0: me.topLevel + 0.08,
            y1: me.topLevel + 0.96,
          });
    }
    const Ne = (me, Re) => {
        for (const et of C) {
          const kt = me - et.centre[0],
            M = Re - et.centre[1],
            ee = Math.cos(et.angle),
            ge = Math.sin(et.angle),
            ae = kt * ee - M * ge,
            de = kt * ge + M * ee;
          if (Math.abs(ae) <= et.length * 0.5 && Math.abs(de) <= et.width * 0.5)
            return t.MathUtils.lerp(et.startLevel, et.endLevel, (ae + et.length * 0.5) / et.length);
        }
        return -1 / 0;
      },
      z = new t.Group();
    ((z.name = "Cabane_a_bois_du_fond_du_jardin"), z.position.set(-124, 2.067, 95), (z.rotation.y = 1.7), pe.add(z));
    const ce = 9.8,
      V = 2.75,
      Me = 2.24,
      je = 2.01,
      lt = (Me - je) / V;
    x("Plancher_sur_sole_du_bucher", [0, 0.015, 0], [ce, 0.13, V], h, z);
    for (const me of [-4.9, -2.45, 0, 2.45, 4.9])
      for (const Re of [-V * 0.5, V * 0.5]) {
        const et = z.position.x + me * Math.cos(z.rotation.y) + Re * Math.sin(z.rotation.y),
          kt = z.position.z - me * Math.sin(z.rotation.y) + Re * Math.cos(z.rotation.y),
          M = he(et, kt) - z.position.y - 0.08;
        x("Plot_de_pierre_du_bucher", [me, M * 0.5, Re], [0.27, Math.max(0.08, -M), 0.28], te.stone, z);
      }
    for (const me of [-4.9, -2.45, 0, 2.45, 4.9])
      (x("Poteau_du_bucher", [me, Me * 0.5, V * 0.5], [0.17, Me, 0.18], h, z),
        x("Poteau_arriere_du_bucher", [me, je * 0.5, -V * 0.5], [0.16, je, 0.16], h, z),
        c("Chevron_du_bucher", [me, je, -V * 0.5 - 0.25], [me, Me, V * 0.5 + 0.3], 0.13, 0.15, k, z));
    for (const me of [-V * 0.5, V * 0.5]) {
      const Re = me < 0 ? je : Me;
      x("Sabliere_du_bucher", [0, Re - 0.08, me], [ce + 0.25, 0.17, 0.18], h, z);
    }
    for (let me = 0; me < 10; me++)
      x("Bardage_horizontal_du_bucher", [0, 0.16 + me * 0.19, -V * 0.5], [ce, 0.17, 0.1], me % 3 ? k : h, z);
    for (const me of [-1, 1])
      for (let Re = 0; Re < 10; Re++)
        x("Bardage_lateral_du_bucher", [me * 4.9, 0.16 + Re * 0.19, 0], [0.1, 0.17, V], Re % 3 ? k : h, z);
    for (const me of [-4.9, -2.45, 0, 2.45])
      c("Contreventement_diagonal_du_bucher", [me + 0.12, 0.26, -1.28], [me + 2.34, 1.85, -1.28], 0.1, 0.09, h, z);
    const Ke = x("Tole_patinee_du_bucher", [0, (Me + je) * 0.5 + 0.08, 0], [ce + 0.55, 0.065, V + 0.7], p, z);
    Ke.rotation.x = -Math.atan(lt);
    for (let me = 0; me < 59; me++) {
      const Re = x(
        "Ondulation_toiture_du_bucher",
        [-5.1 + me * 0.176, (Me + je) * 0.5 + 0.118, 0],
        [0.045, 0.044, V + 0.73],
        p,
        z,
      );
      Re.rotation.x = -Math.atan(lt);
    }
    for (let me = 0; me < 4; me++) {
      const Re = -3.675 + me * 2.45;
      for (const et of [-0.75, 0.6]) x("Support_palette_bucher", [Re, 0.12, et], [2.18, 0.14, 0.17], b, z);
      for (let et = 0; et < 9; et++)
        x("Lattes_palette_bucher", [Re - 1.05 + et * 0.263, 0.21, -0.07], [0.21, 0.08, 2.02], h, z);
    }
    const ve = 152,
      qe = new t.CylinderGeometry(1, 1, 1, 7),
      Xe = new t.CircleGeometry(1, 9),
      _t = new t.InstancedMesh(qe, h, ve),
      Mt = new t.InstancedMesh(Xe, S, ve * 2);
    ((_t.name = "Buches_empilees_du_bucher"),
      (Mt.name = "Bois_de_coupe_des_buches"),
      (_t.castShadow = _t.receiveShadow = !0),
      (Mt.receiveShadow = !0),
      z.add(_t, Mt));
    for (let me = 0; me < ve; me++) {
      const Re = me % 4,
        et = Math.floor(me / 4),
        kt = et % 8,
        M = Math.floor(et / 8),
        ee = 0.105 + (me % 5) * 0.009,
        ge = -4.64 + Re * 2.45 + kt * 0.274 + (M % 2) * 0.06,
        ae = 0.36 + M * 0.225,
        de = -0.28 + (me % 3) * 0.025,
        oe = 1.42 + (me % 4) * 0.13;
      (v.position.set(ge, ae, de),
        v.rotation.set(Math.PI / 2, 0, 0),
        v.scale.set(ee, oe, ee),
        v.updateMatrix(),
        _t.setMatrixAt(me, v.matrix));
      for (const y of [-1, 1])
        (v.position.set(ge, ae, de + y * (oe * 0.5 + 0.003)),
          v.rotation.set(0, y < 0 ? Math.PI : 0, (me * 0.31) % 6.28),
          v.scale.set(ee * 0.92, ee * 0.92, 1),
          v.updateMatrix(),
          Mt.setMatrixAt(me * 2 + (y > 0 ? 1 : 0), v.matrix));
    }
    ((_t.instanceMatrix.needsUpdate = !0), (Mt.instanceMatrix.needsUpdate = !0));
    const st = z.position.y;
    for (const me of [-1, 1])
      A.solidRects.push({
        name: "Paroi_bucher_v25",
        cx: z.position.x,
        cz: z.position.z,
        angle: z.rotation.y,
        u0: me * 4.9 - 0.09,
        u1: me * 4.9 + 0.09,
        v0: -1.42,
        v1: 1.42,
        y0: st,
        y1: st + 2.2,
      });
    A.solidRects.push(
      {
        name: "Fond_bucher_v25",
        cx: z.position.x,
        cz: z.position.z,
        angle: z.rotation.y,
        u0: -4.9,
        u1: 4.9,
        v0: -1.43,
        v1: -1.32,
        y0: st,
        y1: st + 2.05,
      },
      {
        name: "Buches_bucher_v25",
        cx: z.position.x,
        cz: z.position.z,
        angle: z.rotation.y,
        u0: -4.85,
        u1: 4.85,
        v0: -1.2,
        v1: 0.67,
        y0: st,
        y1: st + 1.51,
      },
    );
    function $(me, Re) {
      let et = me - z.position.x,
        kt = Re - z.position.z,
        M = Math.cos(z.rotation.y),
        ee = Math.sin(z.rotation.y);
      return [et * M - kt * ee, et * ee + kt * M];
    }
    function U(me, Re) {
      const [et, kt] = $(me, Re);
      return Math.abs(et) < 5.1 && kt > -1.6 && kt < 3.1;
    }
    function He(me, Re) {
      const [et, kt] = $(me, Re);
      if (Math.abs(et) > 4.98 || kt < -1.48 || kt > 3.1) return -1 / 0;
      const M = z.position.x + et * Math.cos(z.rotation.y) + 3.1 * Math.sin(z.rotation.y),
        ee = z.position.z - et * Math.sin(z.rotation.y) + 3.1 * Math.cos(z.rotation.y);
      return kt <= 1.38
        ? z.position.y + 0.081
        : t.MathUtils.lerp(z.position.y + 0.081, he(M, ee) + 0.025, (kt - 1.38) / 1.72);
    }
    const Ce = [],
      xe = [];
    for (let me = 0; me <= 24; me++)
      for (const Re of [1.375, 3.1]) {
        const et = -4.9 + (me * 9.8) / 24,
          kt = z.position.x + et * Math.cos(z.rotation.y) + Re * Math.sin(z.rotation.y),
          M = z.position.z - et * Math.sin(z.rotation.y) + Re * Math.cos(z.rotation.y);
        if ((Ce.push(kt, He(kt, M), M), Re === 1.375 && me < 24)) {
          const ee = me * 2;
          xe.push(ee, ee + 2, ee + 3, ee, ee + 3, ee + 1);
        }
      }
    const H = new t.BufferGeometry();
    (H.setAttribute("position", new t.Float32BufferAttribute(Ce, 3)), H.setIndex(xe), H.computeVertexNormals());
    const W = new t.Mesh(H, T("#817c5a", { roughness: 1 }));
    ((W.name = "Acces_en_terre_tassee_du_bucher"), (W.receiveShadow = !0), pe.add(W));
    const D = {
        name: "Sentier_rivierain_du_fond_du_domaine_v25",
        label: "Sentier du sous-bois et de la rivi\xE8re",
        width: 2.85,
        points: [
          [-104.75, 103.47],
          [-105.909, 102.499],
          [-107.674, 103.505],
          [-109.003, 104.92],
          [-110.889, 107.059],
          [-112.8, 109.314],
          [-113.711, 110.896],
          [-114.622, 112.479],
          [-114.743, 112.566],
          [-114.867, 112.802],
          [-116.285, 114.017],
          [-117.898, 115.004],
          [-119.202, 115.742],
          [-120.265, 116.434],
          [-121.849, 117.129],
          [-123.433, 117.825],
          [-124.56, 118.238],
          [-125.461, 118.643],
          [-127.007, 119.047],
          [-128.554, 119.451],
          [-132.123, 121.598],
          [-133.711, 125.363],
          [-134.656, 126.915],
          [-135.601, 128.468],
          [-135.29, 128.467],
          [-135.398, 128.617],
          [-137.126, 129.589],
          [-138.854, 130.561],
          [-140.582, 131.533],
          [-143.204, 133.1],
          [-145.466, 135.012],
          [-146.77, 136.028],
          [-148.074, 137.044],
          [-147.91, 136.753],
          [-148.212, 136.705],
          [-149.847, 137.745],
          [-151.242, 139.335],
          [-152.757, 140.65],
          [-154.273, 141.965],
          [-156.973, 143.989],
          [-159.084, 146.502],
          [-160.218, 148.014],
          [-161.352, 149.526],
          [-162.486, 151.038],
          [-162.775, 151.656],
          [-163.103, 151.968],
          [-164.678, 152.733],
          [-166.253, 153.498],
          [-167.828, 154.263],
          [-169.403, 155.028],
          [-171.993, 156.444],
          [-174.184, 158.556],
          [-175.608, 159.882],
          [-176.796, 161.394],
          [-177.984, 162.906],
          [-178.657, 163.847],
          [-179.457, 164.347],
          [-180.897, 165.382],
          [-182.337, 166.417],
          [-183.777, 167.452],
          [-185.217, 168.487],
          [-186.252, 169.256],
          [-187.526, 169.518],
          [-189.232, 170.013],
          [-191.07, 170.238],
          [-192.907, 170.464],
          [-195.137, 169.879],
          [-198.666, 172.333],
          [-201.171, 175.697],
          [-202.251, 177.371],
          [-203.331, 179.045],
          [-204.411, 180.719],
          [-204.864, 181.54],
          [-205.42, 181.949],
          [-206.77, 183.191],
          [-208.12, 184.433],
          [-209.267, 185.896],
          [-211.497, 188.578],
          [-213.068, 191.66],
          [-213.824, 193.334],
          [-214.58, 195.008],
          [-215.336, 196.682],
          [-215.359, 196.556],
          [-215.258, 196.573],
          [-216.509, 197.976],
          [-217.949, 199.146],
          [-219.389, 200.316],
          [-220.829, 201.486],
          [-222.269, 202.656],
        ],
        side: 0,
      },
      De = new t.Group();
    ((De.name = D.name), (De.userData.editableNativePath21 = !0), pe.add(De));
    const ke = D.points,
      rt = T("#8a8062", { map: O.gravel, roughness: 1, vertexColors: !0 }),
      $e = [],
      B = [],
      F = [],
      g = [],
      G = new Map();
    for (let me = 1; me < ke.length; me++) {
      const Re = ke[me - 1],
        et = ke[me];
      for (
        let kt = Math.floor((Math.min(Re[0], et[0]) - 4) / 8);
        kt <= Math.floor((Math.max(Re[0], et[0]) + 4) / 8);
        kt++
      )
        for (
          let M = Math.floor((Math.min(Re[1], et[1]) - 4) / 8);
          M <= Math.floor((Math.max(Re[1], et[1]) + 4) / 8);
          M++
        ) {
          const ee = kt + "," + M;
          (G.has(ee) || G.set(ee, []), G.get(ee).push(me));
        }
    }
    function Qe(me, Re) {
      let et = 1 / 0;
      for (const kt of G.get(Math.floor(me / 8) + "," + Math.floor(Re / 8)) || []) {
        let M = ke[kt - 1],
          ee = ke[kt],
          ge = ee[0] - M[0],
          ae = ee[1] - M[1],
          de = t.MathUtils.clamp(((me - M[0]) * ge + (Re - M[1]) * ae) / (ge * ge + ae * ae), 0, 1);
        et = Math.min(et, Math.hypot(me - M[0] - de * ge, Re - M[1] - de * ae));
      }
      return et;
    }
    const Fe = [];
    let Le = 0;
    for (let me = 1; me < ke.length; me++) {
      const Re = ke[me - 1],
        et = ke[me],
        kt = Math.hypot(et[0] - Re[0], et[1] - Re[1]),
        M = Math.ceil(kt / 0.75);
      for (let ee = 0; ee < M; ee++) {
        const ge = ee / M;
        Fe.push([Re[0] + (et[0] - Re[0]) * ge, Re[1] + (et[1] - Re[1]) * ge, Le + kt * ge]);
      }
      Le += kt;
    }
    Fe.push([...ke.at(-1), Le]);
    for (let me = 0; me < Fe.length; me++) {
      const Re = Fe[me],
        et = Fe[Math.max(0, me - 1)],
        kt = Fe[Math.min(Fe.length - 1, me + 1)],
        M = kt[0] - et[0],
        ee = kt[1] - et[1],
        ge = Math.hypot(M, ee) || 1;
      for (const ae of [-1, 1]) {
        const de = D.width * 0.5 * (1 + 0.04 * Math.sin(Re[2] * 1.2)),
          oe = Re[0] - (ee / ge) * de * ae,
          y = Re[1] + (M / ge) * de * ae;
        ($e.push(oe, he(oe, y) + 0.043, y), B.push(ae * 0.5 + 0.5, Re[2] * 0.35));
        const I = 0.9 + 0.06 * Math.sin(oe * 0.51 + y * 0.81);
        F.push(I, I, I * 0.95);
      }
      if (me < Fe.length - 1) {
        const ae = me * 2;
        g.push(ae, ae + 3, ae + 2, ae, ae + 1, ae + 3);
      }
    }
    const pt = new t.BufferGeometry();
    (pt.setAttribute("position", new t.Float32BufferAttribute($e, 3)),
      pt.setAttribute("uv", new t.Float32BufferAttribute(B, 2)),
      pt.setAttribute("color", new t.Float32BufferAttribute(F, 3)),
      pt.setIndex(g),
      pt.computeVertexNormals());
    const Ge = new t.Mesh(pt, rt);
    ((Ge.name = "Sol_feuillu_du_sentier_rivierain"),
      (Ge.userData.editableNativePath21 = !0),
      (Ge.receiveShadow = !0),
      De.add(Ge),
      A.propertyTrails.push(D),
      n.siteLayout.trails.push(D));
    const m = A.trailVisible,
      at = A.setPropertyTrailVisible;
    ((A.trailVisible = (me) => (me === D.name ? De.visible : m(me))),
      (A.setPropertyTrailVisible = (me, Re) => {
        me === D.name ? (De.visible = !!Re) : at(me, Re);
      }));
    const ft = [];
    for (let me = 8; me < ke.length - 3; me += 3) {
      const Re = ke[me - 1],
        et = ke[me + 1],
        kt = ke[me],
        M = et[0] - Re[0],
        ee = et[1] - Re[1],
        ge = Math.hypot(M, ee);
      for (const ae of [-1, 1]) {
        const de = 2.32 + (me % 3) * 0.22,
          oe = kt[0] - (ee / ge) * de * ae,
          y = kt[1] + (M / ge) * de * ae;
        a([oe, y], 0.45) ||
          Qe(oe, y) < 1.8 ||
          ft.push({
            id: "objet-" + (95e3 + me * 2 + (ae > 0 ? 1 : 0)),
            type: me % 5 === 0 ? "mousse-rocher" : "fougere",
            x: oe,
            z: y,
            rotation: me * 0.71,
            scale: 0.88 + (me % 4) * 0.14,
            yOffset: 0,
            variant: 0,
          });
      }
    }
    const ue = A.clearanceAt,
      se = A.supportHeight;
    ((A.clearanceAt = (me, Re) =>
      ue(me, Re) ||
      U(me, Re) ||
      (De.visible && Qe(me, Re) < D.width * 0.48) ||
      C.some((et) => {
        const kt = me - et.centre[0],
          M = Re - et.centre[1],
          ee = Math.cos(et.angle),
          ge = Math.sin(et.angle);
        return Math.abs(kt * ee - M * ge) < et.length * 0.5 + 0.1 && Math.abs(kt * ge + M * ee) < et.width * 0.5 + 0.12;
      })),
      (A.supportHeight = (me, Re) => Math.max(se(me, Re), Ne(me, Re), He(me, Re))),
      (re.userData.supportHeight23 = A.supportHeight));
    const Ve = () => {
        const me = pt.attributes.position;
        for (let Re = 0; Re < me.count; Re++) me.setY(Re, he(me.getX(Re), me.getZ(Re)) + 0.043);
        ((me.needsUpdate = !0), pt.computeVertexNormals(), pt.computeBoundingSphere());
      },
      vt = {
        bridgeWidth: 2.65,
        widenedBridges: P.map((me) => me.name),
        rampCount: C.length,
        trailLength: Le,
        trailWidth: D.width,
        trailPoints: ke.length,
        shedPosition: [z.position.x, z.position.z],
        shedAngle: z.rotation.y,
        shedBounds: [
          [-4.9, -1.375],
          [4.9, -1.375],
          [4.9, 3.1],
          [-4.9, 3.1],
        ].map(([me, Re]) => [
          z.position.x + me * Math.cos(z.rotation.y) + Re * Math.sin(z.rotation.y),
          z.position.z - me * Math.sin(z.rotation.y) + Re * Math.cos(z.rotation.y),
        ]),
        shedSize: [ce, Me, V],
        shelterBays: 4,
        stackedLogs: ve,
        defaultPlants: ft.length,
        terrainVertexCount: n.terrainData.mesh.geometry.attributes.position.count,
      };
    return (
      (re.userData.gardenResettle25 = Ve),
      (A.worldStats25 = vt),
      Object.assign(A, {
        garden25: {
          group: pe,
          trail: D,
          trailRoot: De,
          pathMesh: Ge,
          pathDistance: Qe,
          shed: z,
          shedAt: U,
          ramps: C,
          stats: vt,
          defaultObjects: ft,
          resettle: Ve,
        },
      }),
      A.garden25
    );
  }),
  (globalThis.MoulinSteppingStones26 = function (t, n) {
    const { world: A, model: re, architecture: R, channels: he, channelSample: te, standard: O, surfaces: T } = n,
      le = he.find((V) => V.name === "Riviere_amont");
    if (!le) return null;
    const X = le.line[le.line.length - 2],
      a = le.line[le.line.length - 1],
      _e = a[0] - X[0],
      pe = a[1] - X[1],
      q = Math.hypot(_e, pe),
      v = [-pe / q, _e / q],
      k = [(X[0] + a[0]) * 0.5, (X[1] + a[1]) * 0.5],
      h = Math.atan2(-v[1], v[0]),
      b = new t.Group();
    ((b.name = "Trois_pierres_blanches_de_traversee"), R.add(b));
    const p = O("#f4f1df", { roughness: 0.96, vertexColors: !0 }),
      S = [],
      x = [
        [-0.53, -0.36],
        [-0.36, -0.6],
        [0.34, -0.6],
        [0.53, -0.35],
        [0.53, 0.34],
        [0.35, 0.6],
        [-0.35, 0.6],
        [-0.53, 0.36],
      ],
      c = [-1.18, 0, 1.18];
    for (let V = 0; V < 3; V++) {
      const Me = c[V],
        je = k[0] + v[0] * Me,
        lt = k[1] + v[1] * Me,
        Ke = te([je, lt], le).height,
        ve = Ke + [0.225, 0.25, 0.23][V],
        qe = Ke - 0.39,
        Xe = [],
        _t = [],
        Mt = [],
        st = (Ce, xe, H, W) => {
          for (const D of [Ce, xe, H]) (Xe.push(...D), _t.push(W, W, W * 0.99), Mt.push(D[0] * 0.8, D[2] * 0.8));
        };
      for (let Ce = 0; Ce < 8; Ce++) {
        const xe = (Ce + 1) % 8,
          H = x[Ce],
          W = x[xe],
          D = ve - Ke,
          De = [H[0], D, H[1]],
          ke = [W[0], D, W[1]],
          rt = [H[0] * 1.09, D - 0.095, H[1] * 1.075],
          $e = [W[0] * 1.09, D - 0.095, W[1] * 1.075],
          B = [H[0] * 0.93, qe - Ke, H[1] * 0.91],
          F = [W[0] * 0.93, qe - Ke, W[1] * 0.91];
        (st([0, D, 0], ke, De, 0.97 + ((Ce + V) % 3) * 0.012),
          st(De, ke, $e, 0.86 + (Ce % 3) * 0.035),
          st(De, $e, rt, 0.86 + (Ce % 3) * 0.035),
          st(rt, $e, F, 0.68 + (Ce % 4) * 0.04),
          st(rt, F, B, 0.68 + (Ce % 4) * 0.04));
      }
      const $ = new t.BufferGeometry();
      ($.setAttribute("position", new t.Float32BufferAttribute(Xe, 3)),
        $.setAttribute("color", new t.Float32BufferAttribute(_t, 3)),
        $.setAttribute("uv", new t.Float32BufferAttribute(Mt, 2)),
        $.computeVertexNormals(),
        $.computeBoundingSphere());
      const U = new t.Mesh($, p);
      ((U.name = "Pierre_blanche_traversee_" + (V + 1)),
        U.position.set(je, Ke, lt),
        (U.rotation.y = h),
        (U.castShadow = U.receiveShadow = !0),
        b.add(U));
      const He = {
        name: U.name,
        centre: [je, lt],
        angle: h,
        length: 1.06,
        width: 1.2,
        topLevel: ve,
        steppingStone26: !0,
        waterLevel: Ke,
      };
      (A.bridgeSurfaces.push(He), S.push({ ...He, mesh: U }));
    }
    const P = (V, Me) => {
        for (const je of S) {
          const lt = V - je.centre[0],
            Ke = Me - je.centre[1],
            ve = Math.cos(je.angle),
            qe = Math.sin(je.angle),
            Xe = lt * ve - Ke * qe,
            _t = lt * qe + Ke * ve;
          if (Math.abs(Xe) <= je.length * 0.5 + 0.09 && Math.abs(_t) <= je.width * 0.5 + 0.025) return je;
        }
        return null;
      },
      C = A.supportHeight,
      Ne = A.clearanceAt;
    ((A.supportHeight = (V, Me) => {
      var je;
      return Math.max(C(V, Me), ((je = P(V, Me)) == null ? void 0 : je.topLevel) ?? -1 / 0);
    }),
      (A.clearanceAt = (V, Me) => Ne(V, Me) || !!P(V, Me)),
      (re.userData.supportHeight23 = A.supportHeight));
    const z = [-2.6, 2.6].map((V) => [k[0] + v[0] * V, k[1] + v[1] * V]),
      ce = {
        count: 3,
        channel: le.name,
        centre: k,
        axis: v,
        angle: h,
        banks: z,
        stoneGap: 0.12,
        length: 1.06,
        width: 1.2,
        triangles: 120,
        minimumFreeboard: Math.min(...S.map((V) => V.topLevel - V.waterLevel)),
      };
    return ((A.steppingStones26 = { group: b, stones: S, at: P, stats: ce }), A.steppingStones26);
  }),
  (globalThis.MoulinWorld22 = function (t, n) {
    var zo, Oo;
    const {
      model: A,
      house: re,
      data: R,
      bridgeCentre: he,
      xy: te,
      siteLayout: O,
      trailMeshes: T,
      pathSurfaces: le,
      materials: X,
      FLOOR: a,
      polygonMesh: _e,
      architecture: pe,
    } = n;
    A.updateMatrixWorld(!0);
    const q = [
        ...R.featuresV7.footbridges.map((Q) => ({ ...Q, topLevel: Q.deckLevel + 0.05 })),
        {
          name: "Passerelle_bout_du_grand_etang",
          centre: he,
          angle: R.bridge.angleRadians,
          length: R.bridge.length,
          width: R.bridge.width,
          deckLevel: R.bridge.deckLevel,
          topLevel: R.bridge.deckLevel + 0.065,
        },
        {
          name: "Passerelle_amont_du_petit_bassin",
          centre: te(R.upstreamFootbridge.centre),
          angle: R.upstreamFootbridge.angleRadians,
          length: 3.785,
          width: R.upstreamFootbridge.width,
          deckLevel: R.upstreamFootbridge.deckLevel,
          topLevel: R.upstreamFootbridge.deckLevel + 0.045,
        },
      ],
      v = q.find((Q) => Q.name === "Petit_pont_de_la_vanne_naturelle");
    if (v) {
      const Q = A.getObjectByName(v.name),
        Oe =
          ((zo = Q == null ? void 0 : Q.getObjectByName("Planche_de_petit_pont")) == null ? void 0 : zo.material) ||
          X.wood,
        ut = new t.Group();
      ((ut.name = "Acces_bois_jusqua_la_berge_de_la_vanne"), pe.add(ut));
      const At = new t.BoxGeometry(1, 1, 1),
        It = v.length * 0.5 - 0.05,
        Vt = 3.55,
        Ut = 15,
        eo = (Vt - It) / Ut,
        mo = Math.max(
          0.32,
          n.terrainHeight(v.centre[0] + Math.cos(v.angle) * Vt, v.centre[1] - Math.sin(v.angle) * Vt) + 0.04,
        );
      for (let fo = 0; fo < Ut; fo++) {
        const Do = It + (fo + 0.5) * eo,
          ho = (Do - It) / (Vt - It),
          Xo = v.topLevel + (mo - v.topLevel) * ho,
          Ko = v.centre[0] + Math.cos(v.angle) * Do,
          ln = v.centre[1] - Math.sin(v.angle) * Do,
          jo = new t.Mesh(At, Oe);
        ((jo.name = "Planche_acces_vanne_" + fo),
          jo.position.set(Ko, Xo - 0.05, ln),
          jo.scale.set(Math.hypot(eo, (mo - v.topLevel) / Ut) + 0.009, 0.1, v.width),
          (jo.rotation.y = v.angle),
          jo.rotateZ(Math.atan2(mo - v.topLevel, Vt - It)),
          (jo.castShadow = !0),
          (jo.receiveShadow = !0),
          ut.add(jo));
      }
      const vo = (It + Vt) / 2;
      q.push({
        name: ut.name,
        centre: [v.centre[0] + Math.cos(v.angle) * vo, v.centre[1] - Math.sin(v.angle) * vo],
        angle: v.angle,
        length: Vt - It,
        width: v.width,
        startLevel: v.topLevel,
        endLevel: mo,
      });
    }
    const k = Math.cos(re.rotation.y),
      h = Math.sin(re.rotation.y),
      b = (Q, Oe) => [re.position.x + Q * k + Oe * h, re.position.z - Q * h + Oe * k],
      p = [[-3.15, -0.95, 7.15, 9.15]],
      x = [
        [-7.9, -7.4],
        [-4.17, -7.4],
        [-4.17, 7.45],
        [-8.55, 7.45],
        [-8.55, 5.5],
        [-7.95, 3],
        [-7.65, 0.5],
        [-7.75, -3.2],
      ].map((Q) => b(...Q)),
      c = (Q, Oe) => {
        let ut = !1;
        for (let At = 0, It = Oe.length - 1; At < Oe.length; It = At++) {
          const Vt = Oe[At],
            Ut = Oe[It];
          Vt[1] > Q[1] != Ut[1] > Q[1] &&
            Q[0] < ((Ut[0] - Vt[0]) * (Q[1] - Vt[1])) / (Ut[1] - Vt[1]) + Vt[0] &&
            (ut = !ut);
        }
        return ut;
      },
      P = (Q, Oe, ut) => {
        const At = ut[0] - Oe[0],
          It = ut[1] - Oe[1],
          Vt = Math.max(0, Math.min(1, ((Q[0] - Oe[0]) * At + (Q[1] - Oe[1]) * It) / (At * At + It * It || 1)));
        return Math.hypot(Q[0] - Oe[0] - Vt * At, Q[1] - Oe[1] - Vt * It);
      },
      C = (Q, Oe, ut = 0) =>
        c([Q, Oe], x) || (ut > 0 && x.some((At, It) => P([Q, Oe], At, x[(It + 1) % x.length]) < ut));
    function Ne(Q, Oe) {
      const ut = Q - re.position.x,
        At = Oe - re.position.z,
        It = ut * k - At * h,
        Vt = ut * h + At * k;
      return C(Q, Oe, 0.05) || p.some((Ut) => It >= Ut[0] && It <= Ut[1] && Vt >= Ut[2] && Vt <= Ut[3]);
    }
    p.forEach((Q, Oe) =>
      _e(
        [
          [Q[0], Q[2]],
          [Q[1], Q[2]],
          [Q[1], Q[3]],
          [Q[0], Q[3]],
        ].map((ut) => b(...ut)),
        a + 0.086,
        Oe ? X.paving : X.gravel,
        "Seuil_sans_herbe_" + Oe,
        pe,
      ),
    );
    const z = -10.72,
      ce = -7.78,
      V = a + 0.065,
      Me = [
        [2, z],
        [9.2, z],
        [9.2, ce],
        [2, ce],
      ].map((Q) => b(...Q)),
      je = [
        [9.15, z],
        [11.4, z],
        [11.4, ce],
        [9.15, ce],
      ].map((Q) => b(...Q)),
      lt = (Q, Oe) => c([Q, Oe], Me) || c([Q, Oe], je),
      Ke = (Q, Oe) => {
        const ut = Q - re.position.x,
          At = Oe - re.position.z;
        return [ut * k - At * h, ut * h + At * k];
      },
      ve = b(11.4, (z + ce) * 0.5),
      qe = Math.max(a - 0.65, n.terrainHeight(...ve) + 0.1),
      Xe = (Q, Oe) => {
        const ut = Ke(Q, Oe)[0];
        return ut <= 9.15 ? V : t.MathUtils.lerp(V, qe, t.MathUtils.clamp((ut - 9.15) / 2.25, 0, 1));
      },
      _t = O.drive[0],
      Mt = O.drive[1],
      st = Math.hypot(Mt[0] - _t[0], Mt[1] - _t[1]),
      $ = (Mt[0] - _t[0]) / st,
      U = (Mt[1] - _t[1]) / st,
      He = (Q, Oe = 0) => [_t[0] + $ * Q + U * Oe, _t[1] + U * Q - $ * Oe],
      Ce = (Q, Oe) => {
        const ut = Q - _t[0],
          At = Oe - _t[1];
        return [ut * $ + At * U, ut * U - At * $];
      },
      xe = (Q, Oe) => {
        const [ut, At] = Ce(Q, Oe);
        return ut >= 0 && ut <= 15 && Math.abs(At) < 2.15;
      },
      H = (Q, Oe) => {
        const [ut] = Ce(Q, Oe);
        return t.MathUtils.lerp(O.driveLevels[0], O.driveLevels[1], t.MathUtils.clamp(ut / st, 0, 1)) + 0.035;
      };
    function W(Q, Oe) {
      return Ne(Q, Oe) || lt(Q, Oe) || xe(Q, Oe);
    }
    const D = a + 0.045,
      De = _e(x, D, X.gravel, "Passage_gravier_continu_du_moulin_v22", pe);
    De.userData.permanentWalkSurface22 = !0;
    const ke = [{ name: De.name, poly: x, level: D }],
      rt = (Q, Oe) => (lt(Q, Oe) ? Xe(Q, Oe) : C(Q, Oe) ? D : xe(Q, Oe) ? H(Q, Oe) : -1 / 0),
      $e = { clampedVertices: 0, removedGrassTriangles: 0 },
      B = new Set(),
      F = n.terrainData;
    if (F) {
      const Q = F.mesh.geometry,
        Oe = Q.attributes.position,
        ut = (Oo = Q.index) == null ? void 0 : Oo.array,
        At = [
          ...x,
          ...p.flatMap((fo) =>
            [
              [fo[0], fo[2]],
              [fo[1], fo[2]],
              [fo[1], fo[3]],
              [fo[0], fo[3]],
            ].map((Do) => b(...Do)),
          ),
        ],
        It = Math.min(...At.map((fo) => fo[0])) - 0.101,
        Vt = Math.max(...At.map((fo) => fo[0])) + 0.101,
        Ut = Math.min(...At.map((fo) => fo[1])) - 0.101,
        eo = Math.max(...At.map((fo) => fo[1])) + 0.101;
      let mo = 0;
      const vo = (fo, Do) => {
        for (let ho = fo; ho < Do; ho += 3) {
          const Xo = ut[ho],
            Ko = ut[ho + 1],
            ln = ut[ho + 2],
            jo = Oe.getX(Xo),
            an = Oe.getZ(Xo),
            Eo = Oe.getX(Ko),
            tn = Oe.getZ(Ko),
            To = Oe.getX(ln),
            _o = Oe.getZ(ln);
          if (
            Math.max(jo, Eo, To) < It ||
            Math.min(jo, Eo, To) > Vt ||
            Math.max(an, tn, _o) < Ut ||
            Math.min(an, tn, _o) > eo
          )
            continue;
          mo++;
          const fn = [
              [jo, an],
              [Eo, tn],
              [To, _o],
            ],
            Vo = [(jo + Eo + To) / 3, (an + tn + _o) / 3];
          (Ne(...Vo) || C(...Vo, 0.1) || fn.some((Mn) => Ne(...Mn) || C(...Mn, 0.1))) &&
            (B.add(Xo), B.add(Ko), B.add(ln));
        }
      };
      if (ut)
        if (F.renderCells)
          for (const fo of F.renderCells) {
            const Do = fo.coarse[0],
              ho = fo.coarse[2];
            Oe.getX(ho) < It || Oe.getX(Do) > Vt || Oe.getZ(ho) < Ut || Oe.getZ(Do) > eo || vo(fo.start, fo.end);
          }
        else vo(0, ut.length);
      (($e.trianglesTested26 = mo), ($e.protectedVertices26 = B.size));
    }
    function g(Q = !1) {
      var It;
      if (!F) return 0;
      const Oe = F.mesh.geometry,
        ut = Oe.attributes.position;
      let At = 0;
      for (const Vt of B) {
        const Ut = Math.min(F.values[Vt * 3 + 1], a + 0.015);
        (Math.abs(F.values[Vt * 3 + 1] - Ut) > 1e-6 && At++,
          (F.values[Vt * 3 + 1] = ut.array[Vt * 3 + 1] = Ut),
          Q && (F.base[Vt * 3 + 1] = Math.min(F.base[Vt * 3 + 1], Ut)));
      }
      return (
        At &&
          ((ut.needsUpdate = !0),
          Oe.computeVertexNormals(),
          Oe.computeBoundingBox(),
          Oe.computeBoundingSphere(),
          (It = F.refreshRenderBounds) == null || It.call(F)),
        At
      );
    }
    (($e.clampedVertices = g(!0)),
      A.traverse((Q) => {
        var Ut;
        if (!Q.isMesh || !Q.name.startsWith("Brins_d_herbe_des_jardins")) return;
        const Oe = Q.geometry,
          ut = Oe.attributes.position,
          At = ((Ut = Oe.index) == null ? void 0 : Ut.array) || Array.from({ length: ut.count }, (eo, mo) => mo),
          It = [],
          Vt = new t.Vector3();
        for (let eo = 0; eo < At.length; eo += 3) {
          let mo = !1;
          for (let vo = 0; vo < 3; vo++)
            if ((Vt.fromBufferAttribute(ut, At[eo + vo]).applyMatrix4(Q.matrixWorld), W(Vt.x, Vt.z))) {
              mo = !0;
              break;
            }
          mo ? $e.removedGrassTriangles++ : It.push(At[eo], At[eo + 1], At[eo + 2]);
        }
        It.length !== At.length && (Oe.setIndex(It), Oe.computeBoundingBox(), Oe.computeBoundingSphere());
      }));
    const G = [],
      Qe = A.getObjectByName("Abri_accole_arriere_moulin"),
      Fe = (Q, Oe = {}) =>
        n.standard
          ? n.standard(Q, { roughness: 1, ...Oe })
          : new t.MeshStandardMaterial({ color: new t.Color(Q).convertSRGBToLinear(), roughness: 1, ...Oe }),
      Le = new t.BoxGeometry(1, 1, 1),
      pt = X.wood.clone();
    (pt.color.copy(new t.Color("#958675").convertSRGBToLinear()), (pt.roughness = 0.98));
    const Ge = Fe("#736957"),
      m = Fe("#687675", { metalness: 0.3, roughness: 0.65 }),
      at = X.stone.clone();
    at.color.copy(new t.Color("#ada590").convertSRGBToLinear());
    const ft = (Q, Oe, ut, At, It = pt) => {
        const Vt = new t.Mesh(Le, It);
        return (
          (Vt.name = Oe),
          Vt.position.set(...ut),
          Vt.scale.set(...At),
          (Vt.castShadow = !0),
          (Vt.receiveShadow = !0),
          Q.add(Vt),
          Vt
        );
      },
      ue = (Q, Oe, ut, At, It, Vt, Ut = pt) => {
        const eo = new t.Vector3(...ut),
          mo = new t.Vector3(...At),
          vo = ft(Q, Oe, eo.clone().add(mo).multiplyScalar(0.5).toArray(), [It, eo.distanceTo(mo), Vt], Ut);
        return (vo.quaternion.setFromUnitVectors(new t.Vector3(0, 1, 0), mo.sub(eo).normalize()), vo);
      };
    function se(Q, Oe, ut, At) {
      const It = (ho) => 3.72 + (ho + 7.18) * 0.2687,
        Vt = [
          [Oe, It(-7.18), -7.18],
          [ut, It(-7.18), -7.18],
          [ut, It(-11.85), -11.85],
          [Oe, It(-11.85), -11.85],
        ],
        Ut = [...Vt, ...Vt.map((ho) => [ho[0], ho[1] - 0.115, ho[2]])],
        eo = [
          [0, 1, 2],
          [0, 2, 3],
          [4, 6, 5],
          [4, 7, 6],
          [0, 4, 5],
          [0, 5, 1],
          [1, 5, 6],
          [1, 6, 2],
          [2, 6, 7],
          [2, 7, 3],
          [3, 7, 4],
          [3, 4, 0],
        ],
        mo = [],
        vo = [];
      for (const ho of eo) for (const Xo of ho) (mo.push(...Ut[Xo]), vo.push(Ut[Xo][0] * 0.58, Ut[Xo][2] * 0.58));
      const fo = new t.BufferGeometry();
      (fo.setAttribute("position", new t.Float32BufferAttribute(mo, 3)),
        fo.setAttribute("uv", new t.Float32BufferAttribute(vo, 2)),
        fo.computeVertexNormals());
      const Do = new t.Mesh(fo, X.slate);
      ((Do.name = At), (Do.castShadow = !0), (Do.receiveShadow = !0), Q.add(Do));
    }
    if (Qe) {
      Qe.traverse((Oe) => {
        Oe !== Qe && ((Oe.visible = !1), (Oe.userData.exportSkip = !0));
      });
      const Q = new t.Group();
      ((Q.name = "Carport_traversant_charpente_bois_v23"),
        Qe.add(Q),
        se(Q, -3.72, 8.2, "Ardoises_et_appentis_du_carport_v23"),
        ft(Q, "Poutre_sur_pignon", [0, 3.47, -7.26], [7.3, 0.25, 0.23]),
        ft(Q, "Sabliere_du_passage_couvert", [5.82, 3.47, -7.26], [4.65, 0.25, 0.23]),
        ft(Q, "Grande_poutre_frontale", [2.24, 2.29, -11.52], [11.96, 0.26, 0.27]));
      for (const Oe of [-3.45, 3.45, 7.94]) {
        (ft(Q, "Socle_granit_poteau", [Oe, 0.14, -11.5], [0.4, 0.28, 0.4], at),
          ft(Q, "Poteau_chene_vieilli", [Oe, 1.28, -11.5], [0.255, 2.24, 0.255]),
          ue(Q, "Aisselier_lateral", [Oe, 1.71, -11.5], [Oe, 2.73, -10.14], 0.16, 0.17));
        for (const At of [-1, 1])
          Oe + At * 0.7 > -3.7 &&
            Oe + At * 0.7 < 8.13 &&
            ue(Q, "Aisselier_frontal", [Oe, 1.78, -11.5], [Oe + At * 0.78, 2.28, -11.5], 0.15, 0.17);
        for (const At of [0.48, 1.92])
          ft(Q, "Cheville_carree_assemblage", [Oe, At, -11.5 - 0.137], [0.055, 0.055, 0.018], Ge);
        G.push({
          name: "Poteau_carport_v23",
          cx: re.position.x,
          cz: re.position.z,
          angle: re.rotation.y,
          u0: Oe - 0.21,
          u1: Oe + 0.21,
          v0: -11.5 - 0.21,
          v1: -11.5 + 0.21,
          y0: a,
          y1: a + 2.4,
        });
      }
      for (const Oe of [7.94])
        (ft(Q, "Poteau_cote_jardin", [Oe, 1.74, -7.37], [0.23, 3.48, 0.23]),
          ue(Q, "Console_cote_jardin", [Oe, 2.81, -7.37], [Oe, 3.2, -8.32], 0.13, 0.15),
          G.push({
            name: "Poteau_jardin_v23",
            cx: re.position.x,
            cz: re.position.z,
            angle: re.rotation.y,
            u0: Oe - 0.14,
            u1: Oe + 0.14,
            v0: -7.37 - 0.14,
            v1: -7.37 + 0.14,
            y0: a,
            y1: a + 3.5,
          }));
      for (let Oe = 0; Oe < 15; Oe++) {
        const ut = -3.44 + (Oe * 11.35) / 14;
        ue(Q, "Chevron_apparent_carport", [ut, 3.49, -7.27], [ut, 2.24, -11.7], 0.105, 0.16);
      }
      for (let Oe = 0; Oe < 11; Oe++) {
        const ut = -7.39 - Oe * 0.405,
          At = 3.49 + (ut + 7.27) * 0.269;
        ft(Q, "Volige_bois_sous_ardoise", [2.24, At, ut], [11.66, 0.045, 0.36], Oe % 3 ? pt : Ge);
      }
      for (const Oe of [-3.68, 8.16]) ue(Q, "Rive_epaisse_carport", [Oe, 3.64, -7.16], [Oe, 2.36, -11.9], 0.19, 0.23);
      (ft(Q, "Bandeau_chene", [2.24, 2.39, -11.91], [12.12, 0.21, 0.14]),
        ft(Q, "Gouttiere_zinc", [2.24, 2.33, -12.01], [12.14, 0.12, 0.14], m));
      for (const Oe of [-2.8, 3.1, 7.5])
        (ft(Q, "Boitier_lanterne_carport", [Oe, 2.55, -11.62], [0.23, 0.18, 0.095], m),
          ft(
            Q,
            "Vitre_lanterne_carport",
            [Oe, 2.55, -11.68],
            [0.18, 0.13, 0.013],
            Fe("#e9ddad", { emissive: 16761976, emissiveIntensity: 0.24 }),
          ));
    }
    const Ve = Fe("#252e2c", { metalness: 0.66, roughness: 0.53 }),
      vt = Fe("#88918b", { metalness: 0.64, roughness: 0.41 }),
      me = Fe("#565b50", { map: X.wood.map, roughness: 0.84 }),
      Re = Fe("#353d33", { roughness: 0.93 }),
      et = Fe("#d8cfb6", { emissive: 16761725, emissiveIntensity: 0, roughness: 0.28, metalness: 0.05 });
    et.userData.architectureGlow24 = !0;
    const kt = new t.CylinderGeometry(1, 1, 1, 10),
      M = new t.SphereGeometry(1, 8, 6);
    function ee(Q, Oe, ut, At, It, Vt = vt) {
      const Ut = new t.Vector3(...ut),
        eo = new t.Vector3(...At),
        mo = new t.Mesh(kt, Vt);
      return (
        (mo.name = Oe),
        mo.position.copy(Ut).add(eo).multiplyScalar(0.5),
        mo.scale.set(It, Ut.distanceTo(eo), It),
        mo.quaternion.setFromUnitVectors(new t.Vector3(0, 1, 0), eo.sub(Ut).normalize()),
        (mo.castShadow = !0),
        Q.add(mo),
        mo
      );
    }
    function ge(Q, Oe, ut, At, It = Ve) {
      const Vt = new t.CatmullRomCurve3(ut.map((eo) => new t.Vector3(...eo))),
        Ut = new t.Mesh(new t.TubeGeometry(Vt, 24, At, 6, !1), It);
      return ((Ut.name = Oe), (Ut.castShadow = !0), Q.add(Ut), Ut);
    }
    function ae(Q, Oe, ut, At, It = 0.095) {
      const Vt = new t.Vector3(...ut),
        Ut = new t.Vector3(...At),
        eo = Ut.clone().sub(Vt).normalize(),
        mo = new t.Vector3().crossVectors(eo, new t.Vector3(0, 1, 0)).normalize(),
        vo = [],
        fo = [],
        Do = [],
        ho = 12;
      for (let jo = 0; jo <= ho; jo++) {
        const an = (jo / ho) * Math.PI,
          Eo = mo
            .clone()
            .multiplyScalar(Math.cos(an) * It)
            .add(new t.Vector3(0, -Math.sin(an) * It, 0));
        for (const tn of [Vt, Ut])
          (vo.push(...tn.clone().add(Eo).toArray()), fo.push(...Eo.clone().normalize().toArray()));
        if (jo < ho) {
          const tn = jo * 2;
          Do.push(tn, tn + 1, tn + 2, tn + 1, tn + 3, tn + 2);
        }
      }
      const Xo = new t.BufferGeometry();
      (Xo.setAttribute("position", new t.Float32BufferAttribute(vo, 3)),
        Xo.setAttribute("normal", new t.Float32BufferAttribute(fo, 3)),
        Xo.setIndex(Do));
      const Ko = vt.clone();
      Ko.side = t.DoubleSide;
      const ln = new t.Mesh(Xo, Ko);
      ((ln.name = Oe), (ln.castShadow = !0), Q.add(ln));
      for (const jo of [-1, 1])
        ee(
          Q,
          "Ourlet_de_gouttiere",
          Vt.clone()
            .addScaledVector(mo, jo * It)
            .toArray(),
          Ut.clone()
            .addScaledVector(mo, jo * It)
            .toArray(),
          0.014,
        );
      return ln;
    }
    const de = new t.Group();
    ((de.name = "Porte_lanternes_et_rigole_photographiques_v24"), re.add(de));
    const oe = re.children.find((Q) => Q.name === "Ouverture_porte" && Math.abs(Q.position.x + 4.24) < 0.02);
    if (oe) {
      for (const ut of oe.children) ut.name === "Porte" && (ut.visible = !1);
      const Q = new t.Group();
      ((Q.name = "Porte_du_moulin_menuiserie_detaillee_v24"),
        Q.position.copy(oe.position),
        Q.rotation.copy(oe.rotation),
        de.add(Q),
        ft(Q, "Dormant_patine", [0, 0, 0.074], [1.22, 2.35, 0.11], me),
        ft(Q, "Joint_ombre_de_la_porte", [0, 0, 0.14], [1.09, 2.21, 0.018], Re));
      for (const ut of [-0.49, 0.49]) ft(Q, "Montant_de_porte", [ut, 0, 0.164], [0.105, 2.19, 0.07], me);
      for (const ut of [-1.055, -0.2, 1.055]) ft(Q, "Traverse_de_porte", [0, ut, 0.169], [1.045, 0.1, 0.08], me);
      for (const ut of [-0.235, 0.235]) {
        ft(Q, "Panneau_bois_bas", [ut, -0.645, 0.162], [0.4, 0.73, 0.055], me);
        for (const At of [-0.96, -0.34]) ft(Q, "Moulure_de_panneau", [ut, At, 0.206], [0.355, 0.026, 0.023], pt);
        for (const At of [ut - 0.18, ut + 0.18])
          ft(Q, "Moulure_de_panneau", [At, -0.65, 0.206], [0.026, 0.65, 0.023], pt);
      }
      const Oe = Fe("#647873", { roughness: 0.17, metalness: 0.18, emissive: 16766888, emissiveIntensity: 0 });
      ((Oe.userData.architectureGlow24 = !0),
        ft(Q, "Vitrage_haut_de_porte", [0, 0.422, 0.17], [0.92, 1.115, 0.028], Oe),
        ft(Q, "Meneau_vertical_porte", [0, 0.42, 0.21], [0.045, 1.12, 0.042], me));
      for (const ut of [0.065, 0.43, 0.79]) ft(Q, "Petit_bois_porte", [0, ut, 0.21], [0.94, 0.036, 0.042], me);
      (ft(Q, "Plaque_de_serrure", [0.38, -0.12, 0.24], [0.047, 0.22, 0.022], Ve),
        ee(
          Q,
          "Poignee_laiton_vieilli",
          [0.38, -0.06, 0.27],
          [0.28, -0.06, 0.27],
          0.022,
          Fe("#8a7851", { metalness: 0.72, roughness: 0.44 }),
        ));
      for (const ut of [-0.82, 0.79])
        (ee(Q, "Paumelle_ancienne", [-0.54, ut - 0.09, 0.21], [-0.54, ut + 0.09, 0.21], 0.02, Ve),
          ft(Q, "Ferrure_ancienne", [-0.455, ut, 0.211], [0.16, 0.043, 0.012], Ve));
      ft(Q, "Seuil_granit_use", [0, -1.16, 0.28], [1.35, 0.12, 0.6], at);
    }
    const y = Fe("#655f50", { map: X.stone.map, roughness: 0.98 });
    for (let Q = 0; Q < 28; Q++) {
      const Oe = -6.95 + (Q + 0.5) * 0.495;
      (ft(de, "Fond_rigole_au_pied_du_mur", [-4.57, 0.027, Oe], [0.47, 0.045, 0.5], y),
        ft(de, "Bordure_de_pierre_rigole", [-4.9, 0.096, Oe], [0.19, 0.19, 0.48], I(Q)));
    }
    function I(Q) {
      return Q % 3 ? at : X.stone;
    }
    for (const Q of [-6.64, 6.46]) {
      ft(de, "Cadre_de_grille_drainage", [-4.56, 0.066, Q], [0.55, 0.065, 0.65], Ve);
      for (let Oe = 0; Oe < 9; Oe++)
        ft(de, "Barreau_grille_de_drainage", [-4.81 + Oe * 0.062, 0.106, Q], [0.026, 0.032, 0.64], vt);
    }
    re.traverse((Q) => {
      [
        "Descente_de_gouttiere",
        "Collier_de_gouttiere",
        "Gouttiere_en_zinc",
        "Descente_eaux_pluviales",
        "Collier_de_descente",
        "Coude_de_descente",
      ].includes(Q.name) && ((Q.visible = !1), (Q.userData.exportSkip = !0));
    });
    for (const Q of [-1, 1]) {
      ae(de, "Gouttiere_zinc_ouverte_sous_egout", [Q * 4.49, 6.47, -7.43], [Q * 4.49, 6.47, 7.43], 0.1);
      for (const Oe of [-7.03, 7.03]) {
        (ee(de, "Coude_zinc_superieur", [Q * 4.49, 6.42, Oe], [Q * 4.34, 5.94, Oe], 0.059),
          ee(de, "Descente_zinc_facade", [Q * 4.34, 5.94, Oe], [Q * 4.34, 0.29, Oe], 0.057),
          ee(de, "Bec_de_descente_vers_rigole", [Q * 4.34, 0.29, Oe], [Q * 4.6, 0.13, Oe], 0.06));
        for (const ut of [0.62, 2.95, 5.53]) {
          const At = new t.Mesh(new t.TorusGeometry(0.064, 0.012, 5, 10), Ve);
          ((At.name = "Collier_zinc_scelle"),
            (At.rotation.x = Math.PI / 2),
            At.position.set(Q * 4.34, ut, Oe),
            de.add(At));
        }
      }
    }
    function Be(Q, Oe) {
      const ut = new t.Group();
      ((ut.name = "Lanterne_ferronnerie_photographique_v24"),
        ut.position.set(...Q),
        (ut.rotation.y = Oe),
        de.add(ut),
        ft(ut, "Platine_murale", [0, 0.15, 0], [0.095, 0.49, 0.06], Ve),
        ee(ut, "Bras_haut_lanterne", [0, 0.39, 0.025], [0, 0.39, 0.54], 0.024, Ve),
        ge(
          ut,
          "Console_courbe_en_fer",
          [
            [0, -0.02, 0.04],
            [0, 0.09, 0.23],
            [0, 0.18, 0.42],
            [0, 0.34, 0.48],
          ],
          0.018,
        ),
        ge(
          ut,
          "Volute_de_console",
          [
            [0, 0.27, 0.15],
            [0, 0.15, 0.19],
            [0, 0.16, 0.32],
            [0, 0.28, 0.33],
            [0, 0.32, 0.25],
            [0, 0.26, 0.23],
          ],
          0.014,
        ),
        ee(ut, "Suspente_lanterne", [0, 0.4, 0.54], [0, 0.21, 0.54], 0.031, Ve));
      const At = new t.Mesh(new t.CylinderGeometry(0.172, 0.123, 0.43, 4, 1, !1), et);
      ((At.name = "Verre_lanterne_ambre_v24"),
        (At.rotation.y = Math.PI / 4),
        At.position.set(0, -0.04, 0.54),
        ut.add(At));
      for (const Vt of [-1, 1])
        for (const Ut of [-1, 1])
          ee(
            ut,
            "Montant_conique_de_lanterne",
            [Vt * 0.121, 0.18, 0.54 + Ut * 0.121],
            [Vt * 0.087, -0.26, 0.54 + Ut * 0.087],
            0.013,
            Ve,
          );
      for (const [Vt, Ut, eo] of [
        [0.245, 0.251, 0.13],
        [-0.29, 0.169, 0.055],
      ]) {
        const mo = new t.Mesh(new t.ConeGeometry(Ut, eo, 4), Ve);
        ((mo.name = "Chapeau_lanterne_pyramidal"),
          (mo.rotation.y = Math.PI / 4),
          mo.position.set(0, Vt, 0.54),
          ut.add(mo));
      }
      const It = new t.Mesh(M, Ve);
      return (It.scale.set(0.045, 0.073, 0.045), It.position.set(0, -0.365, 0.54), ut.add(It), ut);
    }
    if (
      (Be([-4.32, 2.96, -2.75], -Math.PI / 2),
      Be([-4.32, 2.96, 2.8], -Math.PI / 2),
      Be([-0.35, 2.48, 7.3], 0),
      (re.userData.lanterns24 = !0),
      Qe)
    ) {
      const Q = Qe.getObjectByName("Carport_traversant_charpente_bois_v23");
      if (Q) {
        ((Q.name = "Carport_traversant_charpente_photographique_v24"),
          Q.traverse((At) => {
            ["Gouttiere_zinc", "Boitier_lanterne_carport", "Vitre_lanterne_carport"].includes(At.name) &&
              ((At.visible = !1), (At.userData.exportSkip = !0));
          }),
          ae(Q, "Gouttiere_demi_ronde_du_carport", [-3.82, 2.36, -12.03], [8.3, 2.36, -12.03], 0.105),
          ee(Q, "Descente_zinc_carport", [-3.43, 2.33, -12.03], [-3.43, 0.11, -12.03], 0.061),
          ee(Q, "Sortie_eau_carport", [-3.43, 0.12, -12.03], [-3.71, 0.06, -12.14], 0.064));
        for (const At of [-3.45, 3.45, 7.94])
          for (const It of [-1, 1])
            if (At + It * 0.8 > -3.7 && At + It * 0.8 < 8.2) {
              ue(Q, "Jambe_de_force_assemblage_tenon", [At, 1.49, -11.53], [At + It * 0.98, 2.26, -11.53], 0.18, 0.19);
              for (const Vt of [
                [At, 1.61, -11.68],
                [At + It * 0.74, 2.13, -11.68],
              ])
                ee(Q, "Boulon_noir_de_charpente", [Vt[0], Vt[1], Vt[2]], [Vt[0], Vt[1], Vt[2] - 0.04], 0.025, Ve);
            }
        const Oe = Fe("#65717a", { roughness: 0.9 });
        for (let At = 0; At < 12; At++) {
          const It = -7.38 - At * 0.385,
            Vt = 3.728 + (It + 7.18) * 0.2687;
          ue(Q, "Recouvrement_horizontal_ardoise", [-3.71, Vt, It], [8.19, Vt, It], 0.016, 0.018, Oe);
        }
        for (let At = 0; At < 2; At++)
          for (let It = 0; It < 36; It++) {
            const Vt = -3.68 + (It + (At % 2) * 0.5) * 0.335,
              Ut = -11.7 + At * 0.385,
              eo = 3.74 + (Ut + 7.18) * 0.2687;
            ue(Q, "Joint_vertical_ardoise", [Vt, eo, Ut], [Vt, eo + 0.083, Ut + 0.31], 0.01, 0.013, Oe);
          }
        const ut = Fe("#d8d0bc", { emissive: 16761464, emissiveIntensity: 0, roughness: 0.35 });
        ut.userData.architectureGlow24 = !0;
        for (const At of [-2.8, 3.1, 7.3])
          (ft(Q, "Luminaire_sous_carport", [At, 2.65, -10.3], [0.32, 0.075, 0.2], Ve),
            ft(Q, "Diffuseur_chaud_carport", [At, 2.6, -10.3], [0.27, 0.025, 0.16], ut));
      }
    }
    const Se = new t.Group();
    ((Se.name = "Passage_du_carport_au_jardin_sur_le_bief"), pe.add(Se));
    const N = Fe("#b4ad99", { map: X.gravel.map }),
      Ie = _e(Me, V, N, "Dalle_traversante_au_dessus_du_bief", Se);
    Ie.userData.permanentWalkSurface22 = !0;
    const E = b(5.6, (z + ce) * 0.5),
      Y = ft(Se, "Epaisseur_dalle_du_passage", [E[0], V - 0.105, E[1]], [7.2, 0.21, ce - z], at);
    Y.rotation.y = re.rotation.y;
    const w = _e(je, V, N, "Raccord_doux_vers_la_pelouse_du_jardin", Se),
      be = w.geometry.attributes.position;
    for (let Q = 0; Q < be.count; Q++) be.setY(Q, Xe(be.getX(Q), be.getZ(Q)) - V);
    ((be.needsUpdate = !0),
      w.geometry.computeVertexNormals(),
      w.geometry.computeBoundingSphere(),
      q.push(
        { name: Ie.name, polygon: Me, topLevel: V, width: ce - z, length: 7.2, centre: E, angle: re.rotation.y },
        { name: w.name, polygon: je, topAt: Xe },
      ),
      ke.push({ name: Ie.name, poly: Me, level: V }, { name: w.name, poly: je, topAt: Xe }));
    for (const Q of [4.4, 6.8])
      for (const Oe of [z + 0.11, ce - 0.11]) {
        const ut = b(Q, Oe),
          At = ft(Se, "Culee_pierre_passage_bief", [ut[0], V - 0.4, ut[1]], [0.48, 0.58, 0.4], at);
        At.rotation.y = re.rotation.y;
      }
    const ne = new t.Group();
    ((ne.name = "Entree_du_domaine_murets_et_panneaux_v24"), pe.add(ne));
    const K = ["#afa58d", "#9d9885", "#c3b9a0", "#8d9180"].map((Q) => Fe(Q, { map: X.stone.map })),
      fe = Math.atan2($, U),
      Ee = 3.2,
      bt = 2.75,
      mt = 5.85,
      Ct = 4;
    for (const Q of [-1, 1]) {
      for (let Ut = 0; Ut < Ct; Ut++)
        for (let eo = 0; eo < 9; eo++) {
          const mo = Q * (bt + (eo + 0.5) * 0.65),
            vo = He(Ee, mo),
            fo = n.terrainHeight(...vo),
            Do = ft(
              ne,
              "Pierre_du_muret_transversal_entree",
              [vo[0], fo + 0.095 + Ut * 0.19, vo[1]],
              [0.63, 0.185, 0.51],
              K[(Ut + eo + (Q > 0 ? 1 : 0)) % 4],
            );
          Do.rotation.y = fe + Math.sin(eo * 6.9 + Ut) * 0.025;
        }
      for (let Ut = 0; Ut < 9; Ut++) {
        const eo = He(Ee, Q * (bt + (Ut + 0.5) * 0.65)),
          mo = n.terrainHeight(...eo),
          vo = ft(ne, "Couvertine_muret_transversal_entree", [eo[0], mo + 0.8, eo[1]], [0.65, 0.09, 0.61], K[2]);
        vo.rotation.y = fe;
      }
      const Oe = He(Ee, Q * (bt + mt * 0.5)),
        ut = n.terrainHeight(...Oe);
      G.push({
        name: "Muret_entree_domaine_v24",
        cx: Oe[0],
        cz: Oe[1],
        angle: fe,
        u0: -mt * 0.5,
        u1: mt * 0.5,
        v0: -0.29,
        v1: 0.29,
        y0: ut - 0.3,
        y1: ut + 0.91,
      });
      const At = He(Ee, Q * (bt + 0.22)),
        It = n.terrainHeight(...At);
      for (let Ut = 0; Ut < 5; Ut++) {
        const eo = ft(
          ne,
          "Pile_basse_du_portail",
          [At[0], It + 0.108 + Ut * 0.205, At[1]],
          [0.47, 0.196, 0.62],
          K[Ut % 4],
        );
        eo.rotation.y = fe;
      }
      const Vt = ft(ne, "Chapeau_pile_entree", [At[0], It + 1.075, At[1]], [0.54, 0.11, 0.69], K[2]);
      Vt.rotation.y = fe;
    }
    function Pt(Q) {
      const Oe = document.createElement("canvas");
      ((Oe.width = 1536), (Oe.height = 224));
      const ut = Oe.getContext("2d");
      (ut.clearRect(0, 0, Oe.width, Oe.height),
        (ut.textAlign = "center"),
        (ut.textBaseline = "middle"),
        (ut.font = "700 68px Georgia, serif"));
      let At = 68;
      for (; ut.measureText(Q).width > 1400; ) (At--, (ut.font = "700 " + At + "px Georgia, serif"));
      ((ut.shadowColor = "rgba(20,24,20,.55)"),
        (ut.shadowBlur = 3),
        (ut.shadowOffsetY = 3),
        (ut.fillStyle = "#fff1c9"),
        ut.fillText(Q, 768, 118));
      const It = new t.CanvasTexture(Oe);
      return ((It.encoding = t.sRGBEncoding), (It.anisotropy = 4), It);
    }
    const jt = { x: 1.75, z: -82, rotation: Math.atan2($, U) },
      Dt = { x: 3.15, z: -81, rotation: Math.atan2($, U) },
      we = He(12.6, -3.66),
      We = new t.Group();
    ((We.name = "Panneaux_Moulin_de_Saint_Christophe_Crokmouland"),
      We.position.set(we[0], n.terrainHeight(...we), we[1]),
      (We.rotation.y = Math.atan2(jt.x - we[0], jt.z - we[1])),
      ne.add(We));
    for (const Q of [-1.32, 1.32])
      (ft(We, "Poteau_panneau", [Q, 1.17, 0], [0.18, 2.4, 0.18], Ge),
        ue(We, "Renfort_panneau", [Q, 0.48, -0.08], [Q * 0.32, 1.5, -0.08], 0.12, 0.1, Ge));
    for (const [Q, Oe] of ["MOULIN DE SAINT CHRISTOPHE", "CROKMOULAND"].entries()) {
      const ut = 1.91 - Q * 0.64,
        At = new t.Shape();
      (At.moveTo(1.76, -0.24),
        At.lineTo(-1.49, -0.24),
        At.lineTo(-1.87, 0),
        At.lineTo(-1.49, 0.24),
        At.lineTo(1.76, 0.24),
        At.lineTo(1.64, 0),
        At.closePath());
      const It = new t.ExtrudeGeometry(At, {
          depth: 0.105,
          bevelEnabled: !0,
          bevelSize: 0.025,
          bevelThickness: 0.015,
          bevelSegments: 1,
          steps: 1,
        }),
        Vt = new t.Mesh(It, pt);
      ((Vt.name = Oe), Vt.position.set(0, ut, 0.09), (Vt.castShadow = !0), (Vt.receiveShadow = !0), We.add(Vt));
      const Ut = new t.Mesh(
        new t.PlaneGeometry(3.42, 0.49),
        new t.MeshStandardMaterial({
          map: Pt(Oe),
          transparent: !0,
          alphaTest: 0.04,
          roughness: 1,
          polygonOffset: !0,
          polygonOffsetFactor: -2,
        }),
      );
      ((Ut.name = "Inscription_" + Oe), Ut.position.set(0, ut, 0.218), We.add(Ut));
      for (const eo of [-1.32, 1.32]) ft(We, "Clou_ancien", [eo, ut, 0.222], [0.05, 0.05, 0.022], m);
    }
    const yt = He(22.2, 3.55),
      Ft = new t.Group();
    ((Ft.name = "Panneau_des_commandes_du_domaine_v24"), Ft.position.set(yt[0], n.terrainHeight(...yt), yt[1]));
    const Bt = He(18, 0);
    ((Ft.rotation.y = Math.atan2(Bt[0] - yt[0], Bt[1] - yt[1])), ne.add(Ft));
    for (const Q of [-0.98, 0.98]) ft(Ft, "Pied_panneau_des_commandes", [Q, 1.15, 0], [0.16, 2.3, 0.18], Ge);
    (ft(Ft, "Cadre_boise_panneau_des_commandes", [0, 1.77, 0.02], [2.48, 1.74, 0.16], pt),
      ft(
        Ft,
        "Fond_ardoise_panneau_des_commandes",
        [0, 1.77, 0.112],
        [2.32, 1.57, 0.045],
        Fe("#263d34", { roughness: 0.94 }),
      ));
    const Rt = document.createElement("canvas");
    ((Rt.width = 1536), (Rt.height = 1024));
    const qt = Rt.getContext("2d");
    (qt.clearRect(0, 0, 1536, 1024),
      (qt.textAlign = "center"),
      (qt.fillStyle = "#f5dca4"),
      (qt.font = "700 80px Georgia, serif"),
      qt.fillText("BIENVENUE AU MOULIN", 768, 120),
      (qt.font = "30px Georgia, serif"),
      (qt.fillStyle = "#ded9c7"),
      qt.fillText("Explorez le domaine. Un secret vous attend pr\xE8s du pont\u2026", 768, 184));
    const Kt = [
      ["ZQSD / FL\xC8CHES", "Marcher ou conduire"],
      ["SOURIS", "Regarder autour de soi"],
      ["E", "Monter / descendre du v\xE9hicule"],
      ["R", "Creuser \xE0 pied"],
      ["F", "Lampe, uniquement la nuit"],
      ["MAJ", "Courir / acc\xE9l\xE9rer"],
      ["ESPACE", "Sauter \xE0 pied / freiner en v\xE9hicule"],
    ];
    ((qt.textAlign = "left"),
      Kt.forEach(([Q, Oe], ut) => {
        const At = 281 + ut * 91;
        ((qt.fillStyle = "#e8c77f"),
          (qt.font = "700 39px Arial, sans-serif"),
          qt.fillText(Q, 92, At),
          (qt.fillStyle = "#fff5d9"),
          (qt.font = "37px Arial, sans-serif"),
          qt.fillText(Oe, 485, At));
      }),
      (qt.textAlign = "center"),
      (qt.fillStyle = "#a9bb99"),
      (qt.font = "italic 30px Georgia, serif"),
      qt.fillText("L : lire ce panneau \xB7 Sur mobile : toucher la lettre", 768, 968));
    const ro = new t.CanvasTexture(Rt);
    ((ro.encoding = t.sRGBEncoding), (ro.anisotropy = 4));
    const oo = new t.Mesh(
      new t.PlaneGeometry(2.25, 1.5),
      new t.MeshStandardMaterial({ map: ro, transparent: !0, alphaTest: 0.03, roughness: 1 }),
    );
    ((oo.name = "Touches_et_instructions_dans_le_decor"), oo.position.set(0, 1.77, 0.14), Ft.add(oo));
    const uo = {
        carportPassageWidth: ce - z,
        carportCrossingLength: 7.2,
        carportRampEnd: ve,
        carportLevel: V,
        entranceWallCount: 2,
        entrySpawn: jt,
        entryQuad: Dt,
      },
      Tt = {
        entranceOpening: bt * 2,
        wallAlong: Ee,
        wallLength: mt,
        wallDirection: [U, -$],
        driveDirection: [$, U],
        welcomePosition: [...we],
        welcomeNormal: [Math.sin(We.rotation.y), Math.cos(We.rotation.y)],
        guidePosition: [...yt],
        guideNormal: [Math.sin(Ft.rotation.y), Math.cos(Ft.rotation.y)],
        guideReadingPoint: Bt,
        controls: Kt,
        groundDrainLength: 13.86,
        lanternCount: 3,
      },
      Jt = [-6.2, 6.3].map((Q) => re.localToWorld(new t.Vector3(0, 11.8, Q)).toArray()),
      io = [...T, ...le];
    io.forEach((Q) => (Q.userData.editableNativePath21 = !0));
    const po = new Map(io.map((Q) => [Q.name, Q])),
      Yo = [...O.trails, ...O.hillRoutes].filter((Q) => po.has(Q.name)),
      ao = (Q) => {
        var Oe;
        return ((Oe = po.get(Q)) == null ? void 0 : Oe.visible) !== !1;
      };
    function wo(Q, Oe) {
      const ut = po.get(Q);
      ut && (ut.visible = !!Oe);
    }
    return (
      (A.userData.supportHeight23 = rt),
      {
        entrySpawn: jt,
        entryQuad: Dt,
        worldStats23: uo,
        worldStats24: Tt,
        crossingPolygon: Me,
        rampPolygon: je,
        crossingTop: Xe,
        crossingAt: lt,
        entranceAt: xe,
        bridgeSurfaces: q,
        clearanceAt: W,
        smokeOrigins: Jt,
        propertyTrails: Yo,
        trailVisible: ao,
        setPropertyTrailVisible: wo,
        passagePolygon: x,
        walkSurfaces: ke,
        supportHeight: rt,
        solidRects: G,
        enforceGround: g,
        groundStats: $e,
      }
    );
  }),
  (globalThis.MoulinCatalog21 = {
    prepare(t, n) {
      const A = n.model.getObjectByName("Arbre_souche_du_jardin_intermediaire"),
        re = { found: !!A, sourceName: "Arbre_souche_du_jardin_intermediaire", vertices: 0, parts: 0 };
      if (!A)
        return {
          stats: re,
          install() {
            return { stats: re, record: null, defaultObjects: [], migrateDocument: (_e) => _e };
          },
        };
      n.model.updateMatrixWorld(!0);
      const R = new t.Vector3(),
        he = new t.Quaternion(),
        te = new t.Vector3();
      A.matrixWorld.decompose(R, he, te);
      const O = new t.Euler().setFromQuaternion(he, "YXZ").y,
        T = 1,
        le = new t.Matrix4().compose(
          R,
          new t.Quaternion().setFromAxisAngle(new t.Vector3(0, 1, 0), O),
          new t.Vector3(T, T, T),
        ),
        X = le.clone().invert(),
        a = [];
      return (
        A.traverse((_e) => {
          var q;
          if (!_e.isMesh || !((q = _e.geometry) != null && q.attributes.position)) return;
          const pe = _e.geometry.clone();
          (pe.applyMatrix4(new t.Matrix4().multiplyMatrices(X, _e.matrixWorld)),
            a.push(pe),
            (re.vertices += pe.attributes.position.count));
        }),
        (re.parts = a.length),
        (re.position = R.toArray()),
        (re.rotation = O),
        (re.scale = T),
        A.traverse((_e) => {
          ((_e.visible = !1),
            (_e.userData.exportSkip = !0),
            (_e.userData.catalogueMigrated21 = !0),
            delete _e.userData.renderSource);
        }),
        {
          stats: re,
          install(_e, pe = {}) {
            const q = "#838075",
              v = pe.rgb ? pe.rgb(q) : new t.Color(q).convertSRGBToLinear(),
              k = a.map((S, x) => {
                const c = S.attributes.color;
                if (c) {
                  for (let C = 0; C < c.count; C++) c.setXYZ(C, c.getX(C) / v.r, c.getY(C) / v.g, c.getZ(C) / v.b);
                  c.needsUpdate = !0;
                } else {
                  const C = new Float32Array(S.attributes.position.count * 3);
                  (C.fill(1), S.setAttribute("color", new t.BufferAttribute(C, 3)));
                }
                const P = pe.standard
                  ? pe.standard("#ffffff", { roughness: 1, flatShading: !0, vertexColors: !0, envMapIntensity: 0 })
                  : new t.MeshStandardMaterial({ color: 16777215, roughness: 1, flatShading: !0, vertexColors: !0 });
                return (
                  (P.name = "Bois_de_l_arbre_existant_recolorable"),
                  { geometry: S, material: P, key: "deadTint" + x }
                );
              });
            _e.registerTemplate("arbre-mort", 3, {
              parts: k,
              colliders: [new t.Box3(new t.Vector3(-0.42, 0, -0.42), new t.Vector3(0.57, 3.3, 0.42))],
            });
            const h = (pe.ground || n.ground || (() => R.y))(R.x, R.z),
              b = {
                id: "objet-21000001",
                type: "arbre-mort",
                x: R.x,
                z: R.z,
                yOffset: R.y - h,
                rotation: O,
                scale: T,
                variant: 3,
                color: q,
              };
            function p(S) {
              if (!S || typeof S != "object" || S.catalogueVersion >= 21) return S;
              const x = Array.isArray(S.objects) ? S.objects.map((c) => ({ ...c })) : [];
              return (x.some((c) => c.id === b.id) || x.push({ ...b }), { ...S, objects: x, catalogueVersion: 21 });
            }
            return { stats: re, record: b, defaultObjects: [b], migrateDocument: p };
          },
        }
      );
    },
  }),
  (globalThis.MoulinCatalog22 = {
    prepare(t, n) {
      const A = MoulinCatalog21.prepare(t, n),
        re = n.model.getObjectByName("Mobilier_de_la_terrasse");
      n.model.updateMatrixWorld(!0);
      const R = re ? re.localToWorld(new t.Vector3(1.84, 0, 0)) : null,
        he = re ? new t.Euler().setFromQuaternion(re.getWorldQuaternion(new t.Quaternion()), "YXZ").y : 0;
      return {
        stats: { ...A.stats, parasolTableFound: !!re },
        install(te, O = {}) {
          const T = A.install(te, O),
            le = R ? (O.ground || n.ground || (() => R.y))(R.x, R.z) : 0,
            X = R
              ? {
                  id: "objet-22000001",
                  type: "parasol",
                  x: R.x,
                  z: R.z,
                  yOffset: R.y - le,
                  rotation: he,
                  scale: 1.18,
                  variant: 1,
                  color: "#cf665d",
                }
              : null;
          function a(_e) {
            if (!_e || typeof _e != "object") return _e;
            const pe = T.migrateDocument(_e);
            if (pe.catalogueVersion >= 22) return pe;
            const q = Array.isArray(pe.objects) ? pe.objects.map((v) => ({ ...v })) : [];
            return (
              X && !q.some((v) => v.id === X.id) && q.push({ ...X }),
              { ...pe, objects: q, catalogueVersion: 22 }
            );
          }
          return {
            ...T,
            stats: { ...T.stats, parasolTableFound: !!re },
            parasol: X,
            defaultObjects: [...T.defaultObjects, ...(X ? [X] : [])],
            migrateDocument: a,
          };
        },
      };
    },
  }),
  (globalThis.MoulinGroundLife22 = function (t, n) {
    "use strict";
    var tt;
    const { root: A, model: re, camera: R, terrainHeight: he, wetAt: te, bounds: O } = n,
      T = n.ground || he,
      le = (l, j, ie) => Math.max(j, Math.min(ie, l)),
      X = { value: Number((tt = n.time) == null ? void 0 : tt.value) || 0 },
      a = n.wind || { value: 0 },
      _e = n.windDirection || { value: new t.Vector2(0.83, 0.56).normalize() },
      pe = 32,
      q =
        (A == null ? void 0 : A.dataset.mobile) === "true" ||
        (typeof matchMedia == "function" && matchMedia("(pointer:coarse)").matches),
      v = new t.Group();
    ((v.name = "Herbe_et_vie_du_sol_v21"), (v.userData.exportSkip = !0), re.add(v));
    const k = [],
      h = [],
      b = [],
      p = [],
      S = new Map(),
      x = [],
      c = Array.from({ length: pe }, () => new t.Vector4(0, 0, -100, 0)),
      P = Array.from({ length: pe }, () => new t.Vector3(0.34, 0, 0.94)),
      C = { value: 0 },
      Ne = 2,
      z = O.x0 - Ne,
      ce = O.z0 - Ne,
      V = O.x1 - O.x0 + Ne * 2,
      Me = O.z1 - O.z0 + Ne * 2,
      je = 1024,
      lt = new Uint8Array(je * je * 4),
      Ke = new Uint8Array(je * je * 4),
      ve = new t.DataTexture(lt, je, je, t.RGBAFormat);
    ((ve.magFilter = t.LinearFilter),
      (ve.minFilter = t.LinearFilter),
      (ve.wrapS = ve.wrapT = t.ClampToEdgeWrapping),
      (ve.generateMipmaps = !1),
      (ve.needsUpdate = !0));
    const qe = {
        uEcoMask21: { value: ve },
        uEcoBounds21: { value: new t.Vector4(z, ce, 1 / V, 1 / Me) },
        uGroundTime21: X,
        uGroundWind21: a,
        uGroundDirection21: _e,
        uGroundSteps21: { value: c },
        uGroundContactShape23: { value: P },
        uGroundSnow23: C,
        uGroundRange21: { value: q ? 14 : 18 },
        uGroundMeadowRange25: { value: q ? 58 : 78 },
        uGroundHasContacts26: { value: 0 },
      },
      Xe = `uniform sampler2D uEcoMask21;uniform vec4 uEcoBounds21;varying vec3 vEcoWorld21;
`,
      _t = `uniform sampler2D uEcoMask21;uniform vec4 uEcoBounds21;varying vec3 vEcoWorld21;
float ecoCut21(vec2 p){vec2 uv=(p-uEcoBounds21.xy)*uEcoBounds21.zw;if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.))))return 0.;return texture2D(uEcoMask21,uv).r;}
`,
      Mt = 512,
      st = new Uint8Array(Mt * Mt * 4);
    let $ = 260925;
    function U() {
      return (($ = (Math.imul($, 1664525) + 1013904223) >>> 0), $ / 4294967296);
    }
    for (let l = 0; l < Mt * Mt; l++) {
      const j = 92 + Math.floor(U() * 25);
      st.set([j, 75, 0, 255], l * 4);
    }
    function He(l, j, ie, ze, Ye, zt) {
      const ht = Math.floor(l - ie),
        Lt = Math.ceil(l + ie),
        Qt = Math.floor(j - ie),
        Yt = Math.ceil(j + ie);
      for (let Et = Qt; Et <= Yt; Et++)
        for (let Zt = ht; Zt <= Lt; Zt++) {
          if ((Zt - l) * (Zt - l) + (Et - j) * (Et - j) > ie * ie) continue;
          const bo = ((((Et % Mt) + Mt) % Mt) * Mt + (((Zt % Mt) + Mt) % Mt)) * 4;
          ((st[bo] = ze), (st[bo + 1] = Ye), (st[bo + 2] = zt));
        }
    }
    for (let l = 0; l < 7900; l++) {
      const j = U() * Mt,
        ie = U() * Mt,
        ze = U() * Math.PI * 2,
        Ye = 8 + U() * 16,
        zt = 1.25 + U() * 1.6,
        ht = (U() - 0.5) * 5,
        Lt = Math.cos(ze),
        Qt = Math.sin(ze),
        Yt = 100 + U() * 93;
      for (let Et = 0; Et < 12; Et++) {
        const Zt = Et / 11,
          bo = ht * Zt * Zt,
          go = j + Lt * Ye * Zt - Qt * bo,
          Co = ie + Qt * Ye * Zt + Lt * bo,
          Ao = Math.max(0.55, zt * (1 - Zt * 0.93));
        (He(go + 1.2, Co + 1.4, Ao + 0.6, 67, 60, 180),
          He(go, Co, Ao, Math.min(255, Yt + Zt * 38), 65 + Zt * 145, 255));
      }
    }
    const Ce = new t.DataTexture(st, Mt, Mt, t.RGBAFormat);
    ((Ce.name = "Tapis_de_pelouse_dense_V26"),
      (Ce.wrapS = Ce.wrapT = t.RepeatWrapping),
      (Ce.magFilter = t.LinearFilter),
      (Ce.minFilter = t.LinearMipmapLinearFilter),
      (Ce.generateMipmaps = !0),
      (Ce.anisotropy = 4),
      (Ce.needsUpdate = !0),
      (qe.uTurfTexture26 = { value: Ce }));
    const xe = 256,
      H = new Uint8Array(xe * xe * 4),
      W = new t.Color(),
      D = ["#3b6a42", "#5a8a41", "#83a24c", "#8e8460"].map((l) => new t.Color(l).convertSRGBToLinear());
    function De(l, j, ie) {
      const ze = le((ie - l) / (j - l), 0, 1);
      return ze * ze * (3 - 2 * ze);
    }
    function ke(l, j, ie = 0) {
      const ze = Math.floor(l),
        Ye = Math.floor(j),
        zt = De(0, 1, l - ze),
        ht = De(0, 1, j - Ye),
        Lt = de(ze, Ye, ie),
        Qt = de(ze + 1, Ye, ie),
        Yt = de(ze, Ye + 1, ie),
        Et = de(ze + 1, Ye + 1, ie);
      return (Lt + (Qt - Lt) * zt) * (1 - ht) + (Yt + (Et - Yt) * zt) * ht;
    }
    function rt(l, j, ie, ze, Ye, zt) {
      return 1 - De(0.65, 1.18, Math.hypot((l - ie) / Ye, (j - ze) / zt));
    }
    function $e(l, j) {
      const ie = ke(l * 0.026 + 4, j * 0.026 - 7, 81),
        ze = ke(l * 0.09 + 17, j * 0.09 - 31, 83),
        Ye = ke(l * 0.24, j * 0.24, 87),
        zt = Math.max(
          rt(l, j, 51, -21, 70, 20),
          rt(l, j, -36, 46, 16, 35) * 0.76,
          rt(l, j, 16, 49, 11, 36) * 0.75,
          rt(l, j, 3, -65, 15, 29) * 0.82,
        ),
        ht = De(0.43, 0.76, ze * 0.69 + Ye * 0.31) * (1 - zt * 0.82),
        Lt = De(0.73, 0.91, ze) * De(0.55, 0.83, Ye) * (1 - zt) * 0.33,
        Qt = W.copy(D[0]).lerp(D[1], De(0.13, 0.72, ie));
      (Qt.lerp(D[2], De(0.5, 0.85, ie * 0.56 + ze * 0.44) * 0.67), Qt.lerp(D[3], Lt));
      const Yt = 0.15 + ht * 0.77 + zt * 0.025;
      return [Qt.r, Qt.g, Qt.b, Yt];
    }
    for (let l = 0; l < xe; l++)
      for (let j = 0; j < xe; j++) {
        const ie = $e(z + ((j + 0.5) * V) / xe, ce + ((l + 0.5) * Me) / xe),
          ze = (l * xe + j) * 4;
        for (let Ye = 0; Ye < 4; Ye++) H[ze + Ye] = Math.round(le(ie[Ye], 0, 1) * 255);
      }
    const B = new t.DataTexture(H, xe, xe, t.RGBAFormat);
    ((B.name = "Prairie_composee_terre_tonte_et_touffes_V28"),
      (B.wrapS = B.wrapT = t.ClampToEdgeWrapping),
      (B.magFilter = t.LinearFilter),
      (B.minFilter = t.LinearMipmapLinearFilter),
      (B.generateMipmaps = !0),
      (B.needsUpdate = !0),
      (qe.uGroundField28 = { value: B }));
    const F = new Float32Array(4);
    function g(l, j) {
      const ie = le(((l - z) / V) * xe - 0.5, 0, xe - 1),
        ze = le(((j - ce) / Me) * xe - 0.5, 0, xe - 1),
        Ye = Math.floor(ie),
        zt = Math.floor(ze),
        ht = ie - Ye,
        Lt = ze - zt,
        Qt = Math.min(Ye + 1, xe - 1),
        Yt = Math.min(zt + 1, xe - 1);
      for (let Et = 0; Et < 4; Et++) {
        const Zt = H[(zt * xe + Ye) * 4 + Et],
          bo = H[(zt * xe + Qt) * 4 + Et],
          go = H[(Yt * xe + Ye) * 4 + Et],
          Co = H[(Yt * xe + Qt) * 4 + Et];
        F[Et] = ((Zt + (bo - Zt) * ht) * (1 - Lt) + (go + (Co - go) * ht) * Lt) / 255;
      }
      return F;
    }
    const G = `uniform sampler2D uTurfTexture26,uGroundField28;uniform float uGroundTime21,uGroundWind21,uGroundSnow23;uniform vec2 uGroundDirection21;
 vec3 terrainTurf26(vec2 p,vec2 fieldUV28){vec3 leaf=texture2D(uTurfTexture26,p*.125).rgb;vec4 field28=texture2D(uGroundField28,fieldUV28);float moving=sin(dot(p,normalize(uGroundDirection21+vec2(.001)))*.47-uGroundTime21*(1.3+uGroundWind21));float leafDetail28=.82+leaf.r*.30+leaf.g*.055;return field28.rgb*leafDetail28*(1.+moving*uGroundWind21*.022);}
 `;
    let Qe = null,
      Fe = q ? "fast" : "balanced",
      Le = [],
      pt = !1,
      Ge = -1 / 0,
      m = null,
      at = 0,
      ft = 0,
      ue = -1,
      se = 0,
      Ve = !0,
      vt = 0,
      me = -100,
      Re = null;
    const et = new t.Vector3(),
      kt = new t.Vector3(),
      M = new t.Quaternion(),
      ee = new t.Matrix4(),
      ge = new t.Vector3(0, 1, 0),
      ae = {
        version: 28,
        technique: "shared linear landscape atlas, composed mown lawn and persistent tuft groups",
        fieldTextureSize: 256,
        preloaded: !1,
        preloadYieldCount: 0,
        visibleGrassTiles: 0,
        meadowTiles: 0,
        visibleMeadowTiles: 0,
        turfTextureSize: 512,
        turfExtraDraws: 0,
        tilesBuilt: 0,
        tileBuildMs: 0,
        pendingTiles: 0,
        bladeBaseWidth: 0.028,
        bladeVertices: 20,
        nearTuftBlades28: 4,
        nearTuftTriangles28: 12,
        nearLimit: 26,
        meadowLimit: 116,
        grassTiles: 0,
        grassBlades: 0,
        meadowBlades: 0,
        grassCoverage: 0,
        nativeGrassMeshes: 0,
        staticPlantMeshes: 0,
        cutRegions: 0,
        cutCells: 0,
        footsteps: 0,
        snowFootsteps: 0,
        activeSnowFootprints: 0,
        snowCapacity: 192,
        snowLifetime: 72,
        mudFootsteps: 0,
        activeMudFootprints: 0,
        quadContacts: 0,
        contactCapacity: pe,
        smokePuffs: 0,
        smokeEnabled: !0,
        extraDrawCalls: 0,
      };
    function de(l, j, ie = 0) {
      const ze = Math.sin(l * 127.1 + j * 311.7 + ie * 51.73) * 43758.5453;
      return ze - Math.floor(ze);
    }
    function oe(l, j, ie) {
      var ze;
      return !!ie && ie.length > 2 && ((ze = n.inside) == null ? void 0 : ze.call(n, [l, j], ie));
    }
    const y = [];
    function I(l, j, ie) {
      if (!(!l || l.length < 2))
        for (let ze = 1; ze < l.length; ze++) {
          const Ye = l[ze - 1],
            zt = l[ze];
          y.push({ a: Ye, b: zt, width: j, name: ie });
        }
    }
    for (let l = 0; l < (n.paths || []).length; l++) I(n.paths[l], l === 0 ? 2.3 : 1.7, "original-" + l);
    for (const l of n.propertyTrails || []) I(l.points || l.line, (l.width || 1.2) * 0.5 + 0.3, l.name || l.id || "");
    const Be = new Map(),
      Se = 8,
      N = y.length;
    let Ie = null,
      E = -1 / 0;
    function Y() {
      Be.clear();
      for (const l of y) {
        const j = Math.floor((Math.min(l.a[0], l.b[0]) - l.width - 0.5) / Se),
          ie = Math.floor((Math.max(l.a[0], l.b[0]) + l.width + 0.5) / Se),
          ze = Math.floor((Math.min(l.a[1], l.b[1]) - l.width - 0.5) / Se),
          Ye = Math.floor((Math.max(l.a[1], l.b[1]) + l.width + 0.5) / Se);
        for (let zt = ze; zt <= Ye; zt++)
          for (let ht = j; ht <= ie; ht++) {
            const Lt = ht + ":" + zt;
            (Be.has(Lt) || Be.set(Lt, []), Be.get(Lt).push(l));
          }
      }
    }
    Y();
    function w() {
      if (!n.getPaths) return !1;
      const l = n.getPaths() || [],
        j = JSON.stringify(l.map((ie) => [ie.id || ie.name, ie.width, !!ie.native, ie.points || ie.line]));
      if (j === Ie) return !1;
      ((Ie = j), (y.length = N));
      for (const ie of l)
        if (!ie.native) {
          const ze = y.length;
          I(ie.points || ie.line, (Number(ie.width) || 1.2) * 0.5 + 0.22, ie.id || "");
          for (let Ye = ze; Ye < y.length; Ye++) y[Ye].custom = !0;
        }
      return (Y(), Eo(), !0);
    }
    function be(l, j) {
      for (const ie of Be.get(Math.floor(l / Se) + ":" + Math.floor(j / Se)) || []) {
        if (!ie.custom && n.trailVisible && n.trailVisible(ie.name) === !1) continue;
        const ze = ie.b[0] - ie.a[0],
          Ye = ie.b[1] - ie.a[1],
          zt = le(((l - ie.a[0]) * ze + (j - ie.a[1]) * Ye) / (ze * ze + Ye * Ye || 1), 0, 1);
        if ((l - ie.a[0] - zt * ze) ** 2 + (j - ie.a[1] - zt * Ye) ** 2 < (ie.width + 0.15) ** 2) return !0;
      }
      return !1;
    }
    function ne(l, j) {
      const ie = Math.floor(((l - z) / V) * je),
        ze = Math.floor(((j - ce) / Me) * je);
      return ie >= 0 && ie < je && ze >= 0 && ze < je && lt[(ze * je + ie) * 4] > 110;
    }
    function K(l, j) {
      var ze, Ye;
      if (
        l < O.x0 ||
        l > O.x1 ||
        j < O.z0 ||
        j > O.z1 ||
        ((ze = n.clearanceAt) != null && ze.call(n, l, j)) ||
        ne(l, j) ||
        (te != null && te([l, j], 0.22)) ||
        oe(l, j, n.yard) ||
        oe(l, j, n.patio) ||
        be(l, j) ||
        (n.foundationFootprints || []).some((zt) => {
          var ht;
          return ((ht = n.footprintDistance) == null ? void 0 : ht.call(n, l, j, zt)) < 0.6;
        }) ||
        ((Ye = n.hillCorridorAt) != null && Ye.call(n, l, j, 0.4)) ||
        (n.hillSteps || []).some((zt) => {
          const ht = l - zt.x,
            Lt = j - zt.z;
          return (
            Math.abs(ht * zt.dx + Lt * zt.dz) < zt.length * 0.5 + 0.25 &&
            Math.abs(ht * zt.dz - Lt * zt.dx) < zt.width * 0.5 + 0.3
          );
        })
      )
        return !1;
      const ie = he(l, j);
      return Number.isFinite(ie) && (!n.grassAllowed || n.grassAllowed(l, j));
    }
    if (n.clearanceAt) {
      const l = Math.max(0, Math.floor(((-45 - z) / V) * je)),
        j = Math.min(je - 1, Math.ceil(((45 - z) / V) * je)),
        ie = Math.max(0, Math.floor(((-45 - ce) / Me) * je)),
        ze = Math.min(je - 1, Math.ceil(((45 - ce) / Me) * je));
      for (let Ye = ie; Ye <= ze; Ye++)
        for (let zt = l; zt <= j; zt++) {
          const ht = z + ((zt + 0.5) * V) / je,
            Lt = ce + ((Ye + 0.5) * Me) / je;
          n.clearanceAt(ht, Lt) && (Ke[(Ye * je + zt) * 4] = 255);
        }
    }
    lt.set(Ke);
    function fe(l, j, ie) {
      if (!Number.isFinite(l) || !Number.isFinite(j) || !Number.isFinite(ie) || ie <= 0) return;
      const ze = V / je,
        Ye = Me / je,
        zt = Math.max(ze, Ye) * 0.65,
        ht = le(Math.floor(((l - ie - zt - z) / V) * je), 0, je - 1),
        Lt = le(Math.ceil(((l + ie + zt - z) / V) * je), 0, je - 1),
        Qt = le(Math.floor(((j - ie - zt - ce) / Me) * je), 0, je - 1),
        Yt = le(Math.ceil(((j + ie + zt - ce) / Me) * je), 0, je - 1);
      for (let Et = Qt; Et <= Yt; Et++)
        for (let Zt = ht; Zt <= Lt; Zt++) {
          const bo = z + (Zt + 0.5) * ze,
            go = ce + (Et + 0.5) * Ye,
            Co = Math.round(le((ie + zt - Math.hypot(bo - l, go - j)) / (zt * 2), 0, 1) * 255),
            Ao = (Et * je + Zt) * 4;
          lt[Ao] = Math.max(lt[Ao], Co);
        }
    }
    function Ee(l) {
      var ie;
      ((Le = JSON.parse(JSON.stringify(Array.isArray(l) ? l : []))), lt.set(Ke));
      let j = 0;
      for (const ze of Le)
        if (Array.isArray(ze.cells)) for (const Ye of ze.cells) (fe(+Ye[0], +Ye[1], +Ye[2]), j++);
        else if (Number.isFinite(ze.x) && Number.isFinite(ze.z)) {
          if (ze.width && ze.length) {
            const Ye = ((ze.angle || 0) * Math.PI) / 180,
              zt = Math.cos(Ye),
              ht = Math.sin(Ye),
              Lt = Math.max(0.2, Math.min(ze.width, ze.length) / 12);
            for (let Qt = -ze.length * 0.5; Qt <= ze.length * 0.5; Qt += Lt)
              for (let Yt = -ze.width * 0.5; Yt <= ze.width * 0.5; Yt += Lt)
                fe(ze.x + Yt * zt - Qt * ht, ze.z + Yt * ht + Qt * zt, Lt * 0.8);
          } else fe(ze.x, ze.z, ze.radius || 0.5);
          j++;
        }
      return (
        (ve.needsUpdate = !0),
        (ae.cutRegions = Le.length),
        (ae.cutCells = j),
        Eo(),
        (ie = n.markDirty) == null || ie.call(n),
        ae.cutCells
      );
    }
    function bt(l, j, ie = !1) {
      (Object.assign(l.uniforms, qe),
        (l.vertexShader = Xe + l.vertexShader),
        (l.vertexShader = l.vertexShader.replace(
          "#include <project_vertex>",
          `#include <project_vertex>
vec4 ecoP21=vec4(transformed,1.0);
#ifdef USE_INSTANCING
ecoP21=instanceMatrix*ecoP21;
#endif
vEcoWorld21=(modelMatrix*ecoP21).xyz;`,
        )),
        (l.fragmentShader = _t + l.fragmentShader),
        j === "plant" &&
          (l.fragmentShader = l.fragmentShader.replace(
            "#include <clipping_planes_fragment>",
            `#include <clipping_planes_fragment>
if(ecoCut21(vEcoWorld21.xz)>.39)discard;`,
          )),
        j === "lawn" &&
          !ie &&
          ((l.fragmentShader = G + l.fragmentShader),
          (l.fragmentShader = l.fragmentShader.replace(
            "#include <color_fragment>",
            `#include <color_fragment>
float lawnCoverage26=(1.-smoothstep(.12,.43,ecoCut21(vEcoWorld21.xz)))*(1.-uGroundSnow23);float greenSurface28=smoothstep(.005,.075,diffuseColor.g-max(diffuseColor.r,diffuseColor.b)*.97);diffuseColor.rgb=mix(diffuseColor.rgb,terrainTurf26(vEcoWorld21.xz,(vEcoWorld21.xz-uEcoBounds21.xy)*uEcoBounds21.zw),lawnCoverage26*greenSurface28*.88);`,
          ))));
    }
    const mt = `uniform float uGroundTime21,uGroundWind21,uGroundSnow23,uGroundHasContacts26;uniform vec2 uGroundDirection21,uGroundFocus26;uniform vec4 uGroundSteps21[32];uniform vec3 uGroundContactShape23[32];varying float vGroundHeight23;varying float vGroundTip23;
`,
      Ct = `vec3 groundContact21(vec2 p){if(uGroundHasContacts26<.5)return vec3(0.);float strength=0.;vec2 lean=vec2(0.);for(int k=0;k<32;k++){vec4 s=uGroundSteps21[k];float age=uGroundTime21-s.z;if(age>=0.&&age<1.5){vec3 shape=uGroundContactShape23[k];vec2 forward=vec2(sin(s.w),cos(s.w)),d=p-s.xy;d-=forward*clamp(dot(d,forward),-shape.y,shape.y);float dd=dot(d,d),radius2=shape.x*shape.x;if(dd<radius2){float fade=1.-smoothstep(.30,1.5,age),hit=(1.-smoothstep(radius2*.10,radius2,dd))*fade*shape.z;strength=max(strength,hit);lean+=forward*hit;}}}float len=length(lean);return vec3(min(strength,1.),len>1.?lean/len:lean);}
`;
    function Pt(l, j = !1, ie = !1) {
      (Object.assign(l.uniforms, qe),
        (l.vertexShader =
          mt +
          Ct +
          (j
            ? `attribute vec3 aGrassBase21;attribute float aGrassTip21;
`
            : "") +
          l.vertexShader));
      const ze = j
        ? "vec3 gb21=aGrassBase21;float tip21=aGrassTip21;vec3 worldBase21=(modelMatrix*vec4(gb21,1.)).xyz;float bladeHeight23=max(.06,position.y-gb21.y);"
        : "vec3 worldBase21=(modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.)).xyz;float tip21=clamp(position.y,0.,1.);float bladeHeight23=max(.06,length(instanceMatrix[1].xyz));";
      ((l.vertexShader = l.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
${ze}
float gw21=pow(clamp(uGroundWind21,0.,1.8),.80),phase21=dot(worldBase21.xz,vec2(.39,.25));
float gust23=.80+.20*sin(uGroundTime21*.71+phase21*.31);
float wave21=sin(uGroundTime21*(1.45+gw21*.7)+phase21)+.28*sin(uGroundTime21*3.7+phase21*2.3);
vec3 contact21=${ie ? "(distance(worldBase21.xz,uGroundFocus26)<8.?groundContact21(worldBase21.xz):vec3(0.))" : "groundContact21(worldBase21.xz)"};vec2 windDir23=normalize(uGroundDirection21+vec2(.0001));
vec2 shift21=windDir23*bladeHeight23*gw21*(.30+.43*gust23+.25*wave21)*tip21*tip21+vec2(-windDir23.y,windDir23.x)*bladeHeight23*gw21*.10*sin(uGroundTime21*3.+phase21)*tip21*tip21;
shift21=mix(shift21,contact21.yz*bladeHeight23*.88*tip21,contact21.x);
vGroundHeight23=${j ? "position.y-gb21.y" : "position.y*bladeHeight23"};vGroundTip23=tip21;
${j ? "transformed.xz+=shift21;transformed.y=mix(transformed.y,gb21.y+.006,contact21.x*.92*tip21);" : "vec2 xx21=instanceMatrix[0].xz,zz21=instanceMatrix[2].xz;transformed.x+=dot(shift21,xx21)/max(.001,dot(xx21,xx21));transformed.z+=dot(shift21,zz21)/max(.001,dot(zz21,zz21));transformed.y*=max(.24,1.-contact21.x*.92-min(.42,gw21*.20)*tip21*tip21);"}
`,
      )),
        !j &&
          !ie &&
          ((l.vertexShader =
            `attribute float aGrassBorn27;varying float vGrassBorn27;
` + l.vertexShader),
          (l.vertexShader = l.vertexShader.replace(
            "#include <begin_vertex>",
            `#include <begin_vertex>
vGrassBorn27=aGrassBorn27;`,
          )),
          (l.fragmentShader =
            `uniform float uGroundTime21;varying float vGrassBorn27;
` + l.fragmentShader)),
        bt(l, "plant"),
        (l.fragmentShader =
          `uniform float uGroundSnow23;varying float vGroundHeight23;varying float vGroundTip23;
` + l.fragmentShader),
        (l.fragmentShader = l.fragmentShader.replace(
          "#include <clipping_planes_fragment>",
          `#include <clipping_planes_fragment>
if(uGroundSnow23>.05&&vGroundHeight23<(.07+.13*uGroundSnow23)*uGroundSnow23)discard;`,
        )),
        (l.fragmentShader = l.fragmentShader.replace(
          "#include <color_fragment>",
          `#include <color_fragment>
float winterTip23=uGroundSnow23*smoothstep(.45,.95,vGroundTip23);diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(1.19,.88,.60),winterTip23*.52);`,
        )),
        j ||
          ((l.fragmentShader =
            `uniform sampler2D uGroundField28;uniform float uGroundRange21,uGroundMeadowRange25;uniform vec2 uGroundFocus26;
` + l.fragmentShader),
          (l.fragmentShader = l.fragmentShader.replace(
            "#include <clipping_planes_fragment>",
            `#include <clipping_planes_fragment>
float fieldClump28=texture2D(uGroundField28,(vEcoWorld21.xz-uEcoBounds21.xy)*uEcoBounds21.zw).a;float grassDistance24=max(0.,distance(uGroundFocus26,vEcoWorld21.xz)+(fieldClump28-.40)*6.);float rangeFade21=` +
              (ie
                ? "1.-smoothstep(uGroundMeadowRange25*.44,uGroundMeadowRange25,grassDistance24)"
                : "1.-smoothstep(uGroundRange21*.32,uGroundRange21,grassDistance24)") +
              ";" +
              (ie ? "" : "rangeFade21*=smoothstep(0.,.48,uGroundTime21-vGrassBorn27);") +
              "float rangeNoise21=fract(sin(dot(floor(vEcoWorld21.xz*180.)+vec2(floor(vGroundHeight23*180.),0.),vec2(12.9898,78.233)))*43758.5453);if(rangeNoise21>rangeFade21)discard;",
          ))));
    }
    function jt(l, j, ie = !1) {
      var zt;
      if (!l || k.some((ht) => ht.mat === l && ht.mode === j)) return;
      const ze = l.onBeforeCompile,
        Ye = ((zt = l.customProgramCacheKey) == null ? void 0 : zt.call(l)) || "";
      ((l.onBeforeCompile = function (ht, Lt) {
        (ze == null || ze.call(this, ht, Lt), j === "grass" ? Pt(ht, ie) : bt(ht, j));
      }),
        (l.customProgramCacheKey = () => Ye + "|ground28-" + j + (ie ? "-native" : "")),
        (l.needsUpdate = !0),
        k.push({ mat: l, mode: j }));
    }
    function Dt(l) {
      const j = l.attributes.position;
      if (l.attributes.aGrassBase21) return;
      const ie = new Float32Array(j.count * 3),
        ze = new Float32Array(j.count);
      for (let Ye = 0; Ye < j.count; Ye += 4) {
        let zt = 1 / 0,
          ht = -1 / 0;
        for (let Yt = Ye; Yt < Math.min(Ye + 4, j.count); Yt++)
          ((zt = Math.min(zt, j.getY(Yt))), (ht = Math.max(ht, j.getY(Yt))));
        const Lt = (j.getX(Ye) + j.getX(Math.min(Ye + 1, j.count - 1))) * 0.5,
          Qt = (j.getZ(Ye) + j.getZ(Math.min(Ye + 1, j.count - 1))) * 0.5;
        for (let Yt = Ye; Yt < Math.min(Ye + 4, j.count); Yt++)
          (ie.set([Lt, zt, Qt], Yt * 3), (ze[Yt] = le((j.getY(Yt) - zt) / (ht - zt || 1), 0, 1)));
      }
      (l.setAttribute("aGrassBase21", new t.BufferAttribute(ie, 3)),
        l.setAttribute("aGrassTip21", new t.BufferAttribute(ze, 1)));
    }
    const we = null,
      We = re.getObjectByName("Brins_d_herbe_des_jardins");
    if (we) {
      Dt(we.geometry);
      const l = we.geometry;
      (re.traverse((j) => {
        var ie;
        j.isMesh &&
          ((ie = j.geometry) == null ? void 0 : ie.attributes.position) === l.attributes.position &&
          (j.geometry.setAttribute("aGrassBase21", l.attributes.aGrassBase21),
          j.geometry.setAttribute("aGrassTip21", l.attributes.aGrassTip21),
          b.push(j));
      }),
        jt(we.material, "grass", !0),
        (ae.nativeGrassMeshes = b.length));
    }
    const yt = new Set();
    re.traverse((l) => {
      l.isMesh &&
        /^(Arbustes_|Fleurs_du_|Feuilles_du_massif|Feuillage_des_buissons|Herbes_et_carex|Massifs_et_bruyeres|Fougeres_et_phormiums|Camelias_en_voute)/.test(
          l.name,
        ) &&
        !Array.isArray(l.material) &&
        yt.add(l.material);
    });
    const Ft = new Map();
    (re.traverse((l) => {
      if (
        !(!l.isMesh || l.isInstancedMesh || !yt.has(l.material)) &&
        (jt(l.material, "plant"), p.push(l), l.castShadow)
      ) {
        let j = Ft.get(l.material);
        (j ||
          ((j = new t.MeshDepthMaterial({
            depthPacking: t.RGBADepthPacking,
            side: l.material.side,
            map: l.material.map,
            alphaMap: l.material.alphaMap,
            alphaTest: l.material.alphaTest || 0,
          })),
          (j.onBeforeCompile = (ie) => bt(ie, "plant", !0)),
          (j.customProgramCacheKey = () => "eco21-depth-" + l.material.uuid),
          Ft.set(l.material, j),
          h.push(j)),
          (l.customDepthMaterial = j));
      }
    }),
      (ae.staticPlantMeshes = p.length));
    const Bt = new Set();
    re.traverse((l) => {
      var ie, ze;
      const j = l.material;
      j &&
        !Array.isArray(j) &&
        (j.map === ((ie = n.surfaces) == null ? void 0 : ie.grass) ||
          j === ((ze = n.terrainData) == null ? void 0 : ze.mesh.material)) &&
        Bt.add(j);
    });
    for (const l of Bt) jt(l, "lawn");
    const Rt = new t.BufferGeometry(),
      qt = [],
      Kt = [],
      ro = [];
    for (let l = 0; l < 4; l++) {
      const j = l * 1.61 + (l % 2) * 0.21,
        ie = Math.cos(j),
        ze = Math.sin(j),
        Ye = [0.7, 0.91, 1, 0.79][l],
        zt = 0.15 - (l % 2) * 0.022,
        ht = 0.05,
        Lt = [
          [-zt * 0.5, 0, ht],
          [zt * 0.5, 0, ht],
          [-zt * 0.36, Ye * 0.52, ht + Ye * 0.14],
          [zt * 0.36, Ye * 0.52, ht + Ye * 0.14],
          [0.018, Ye, ht + Ye * 0.43],
        ],
        Qt = qt.length / 3;
      for (let Yt = 0; Yt < Lt.length; Yt++) {
        const [Et, Zt, bo] = Lt[Yt];
        qt.push(Et * ie - bo * ze, Zt, Et * ze + bo * ie);
        const go = Yt < 2 ? [0.58, 0.64, 0.54] : Yt < 4 ? [0.88, 0.93, 0.82] : [1.07, 1.08, 0.99];
        Kt.push(...go);
      }
      ro.push(Qt, Qt + 1, Qt + 2, Qt + 1, Qt + 3, Qt + 2, Qt + 2, Qt + 3, Qt + 4);
    }
    (Rt.setAttribute("position", new t.Float32BufferAttribute(qt, 3)),
      Rt.setAttribute("color", new t.Float32BufferAttribute(Kt, 3)),
      Rt.setIndex(ro),
      Rt.computeVertexNormals());
    const oo = new t.MeshLambertMaterial({ color: 16777215, vertexColors: !0, side: t.DoubleSide });
    ((oo.name = "weather"), (oo.userData.noWeatherPaint22 = !0), jt(oo, "grass"));
    const uo = [0.91, 0.97, 1.04, 1.09, 1],
      Tt = new t.Color(),
      Jt = 8,
      io = 600;
    function po(l, j) {
      const ie = he(l, j);
      return n.grassHeight ? n.grassHeight(l, j) : oe(l, j, n.pointGarden) ? Math.max(ie, T(l, j) - 0.025) : ie;
    }
    function Yo(l, j, ie, ze, Ye, zt, ht, Lt, Qt, Yt = !1) {
      (et.set(ie, ze, Ye),
        kt.set(Yt ? Lt * zt : Lt, zt, zt),
        M.setFromAxisAngle(ge, ht),
        ee.compose(et, M, kt),
        l.setMatrixAt(j, ee));
      const Et = g(ie, Ye),
        Zt = uo[Qt % uo.length];
      (Tt.setRGB(Et[0] * Zt, Et[1] * Zt, Et[2] * Zt), l.setColorAt(j, Tt));
    }
    const ao = 64,
      wo = q ? 2.85 : 2.4,
      zo = new Map(),
      Oo = [],
      Q = new t.BufferGeometry();
    (Q.setAttribute(
      "position",
      new t.Float32BufferAttribute([-0.067, 0, 0, 0.067, 0, 0, -0.046, 0.55, 0.09, 0.046, 0.55, 0.09, 0, 1, 0.4], 3),
    ),
      Q.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4]),
      Q.computeVertexNormals(),
      Q.setAttribute(
        "color",
        new t.Float32BufferAttribute(
          [0.59, 0.65, 0.55, 0.59, 0.65, 0.55, 0.91, 0.96, 0.86, 0.94, 0.98, 0.89, 1.07, 1.08, 1],
          3,
        ),
      ));
    const Oe = new t.MeshLambertMaterial({ color: 16777215, vertexColors: !0, side: t.DoubleSide });
    ((Oe.name = "weather"),
      (Oe.userData.noWeatherPaint22 = !0),
      (Oe.onBeforeCompile = (l) => Pt(l, !1, !0)),
      (Oe.customProgramCacheKey = () => "moulin-permanent-meadow28"));
    const ut = new t.Vector2(R.position.x, R.position.z),
      At = ut.clone(),
      It = new t.Vector3(),
      Vt = ut.clone(),
      Ut = new t.Vector2(),
      eo = ut.clone();
    qe.uGroundFocus26 = { value: At };
    const mo = new t.Frustum(),
      vo = new t.Matrix4();
    let fo = !1,
      Do = !1;
    function ho(l, j, ie, ze, Ye) {
      const zt = Math.max(ie - l, 0, l - ie - Ye),
        ht = Math.max(ze - j, 0, j - ze - Ye);
      return Math.hypot(zt, ht);
    }
    function Xo(l) {
      const { tx: j, tz: ie } = l,
        ze = j + ":" + ie,
        Ye = zo.get(ze),
        zt = 3 * Math.ceil(ao / wo) ** 2,
        ht = (Ye == null ? void 0 : Ye.mesh) || new t.InstancedMesh(Q.clone(), Oe, zt);
      let Lt = 0,
        Qt = 1 / 0,
        Yt = -1 / 0;
      for (let Et = 0; Et < Math.floor(ao / wo); Et++)
        for (let Zt = 0; Zt < Math.floor(ao / wo); Zt++) {
          const bo = j * ao + (Zt + 0.5) * wo,
            go = ie * ao + (Et + 0.5) * wo,
            Co = bo + (de(bo, go, 31) - 0.5) * wo * 0.82,
            Ao = go + (de(bo, go, 32) - 0.5) * wo * 0.82;
          if (!K(Co, Ao)) continue;
          const pn = po(Co, Ao) + 0.006,
            bn = 0.075 + g(Co, Ao)[3] * 0.25 + de(Co, Ao, 34) * 0.023;
          ((Qt = Math.min(Qt, pn)), (Yt = Math.max(Yt, pn + 0.65)));
          for (let en = 0; en < 3; en++) {
            const Ln = de(Co, Ao, 35) * 6.283 + en * 2.17;
            Yo(
              ht,
              Lt++,
              Co + Math.sin(Ln) * 0.095,
              pn,
              Ao + Math.cos(Ln) * 0.095,
              bn * (0.91 + en * 0.11),
              Ln,
              1.4 + de(Co, Ao, en + 36) * 0.77,
              Math.floor(de(Co + en, Ao, 38) * 5),
            );
          }
        }
      return (
        (ht.name = "Prairie_permanente27_" + ze),
        (ht.userData.exportSkip = !0),
        (ht.count = Lt),
        (ht.castShadow = !1),
        (ht.receiveShadow = !0),
        (ht.frustumCulled = !0),
        (ht.visible = Lt > 0),
        (ht.instanceMatrix.needsUpdate = !0),
        ht.instanceColor && (ht.instanceColor.needsUpdate = !0),
        (ht.geometry.boundingSphere = new t.Sphere(
          new t.Vector3((j + 0.5) * ao, Lt ? (Qt + Yt) * 0.5 : 0, (ie + 0.5) * ao),
          Math.hypot(ao * 0.71, Lt ? (Yt - Qt) * 0.5 : 0) + 1,
        )),
        ht.parent || v.add(ht),
        zo.set(ze, { mesh: ht, tx: j, tz: ie }),
        (ae.meadowTiles = zo.size),
        (ae.meadowBlades = [...zo.values()].reduce((Et, Zt) => Et + Zt.mesh.count, 0)),
        (ae.meadowCapacity = [...zo.values()].reduce((Et, Zt) => Et + Zt.mesh.instanceMatrix.count, 0)),
        ht
      );
    }
    function Ko() {
      Oo.length = 0;
      for (let l = Math.floor(O.z0 / ao); l <= Math.floor(O.z1 / ao); l++)
        for (let j = Math.floor(O.x0 / ao); j <= Math.floor(O.x1 / ao); j++) Oo.push({ tx: j, tz: l });
      Oo.sort(
        (l, j) =>
          Math.hypot((l.tx + 0.5) * ao - ut.x, (l.tz + 0.5) * ao - ut.y) -
          Math.hypot((j.tx + 0.5) * ao - ut.x, (j.tz + 0.5) * ao - ut.y),
      );
    }
    function ln() {
      const l = (A == null ? void 0 : A.dataset.mode) === "globe",
        j = qe.uGroundMeadowRange25.value;
      ae.visibleMeadowTiles = 0;
      for (const ie of zo.values())
        ((ie.mesh.visible = ie.mesh.count > 0 && ho(ut.x, ut.y, ie.tx * ao, ie.tz * ao, ao) < j),
          ie.mesh.visible && mo.intersectsObject(ie.mesh) && ae.visibleMeadowTiles++);
    }
    function jo(l, j) {
      var Lt, Qt, Yt, Et;
      const ie = ((Qt = (Lt = globalThis.performance) == null ? void 0 : Lt.now) == null ? void 0 : Qt.call(Lt)) || 0,
        ze = l + ":" + j,
        Ye = x.pop() || new t.InstancedMesh(Rt.clone(), oo, io);
      ((!Ye.instanceColor || Ye.instanceColor.count < io) &&
        (Ye.instanceColor = new t.InstancedBufferAttribute(new Float32Array(io * 3), 3)),
        Ye.geometry.attributes.aGrassBorn27 ||
          Ye.geometry.setAttribute("aGrassBorn27", new t.InstancedBufferAttribute(new Float32Array(1), 1, !1, io)),
        (Ye.geometry.attributes.aGrassBorn27.array[0] = Do ? -1 : X.value),
        (Ye.geometry.attributes.aGrassBorn27.needsUpdate = !0),
        (Ye.name = "Prairie_locale_" + ze),
        (Ye.userData.exportSkip = !0),
        (Ye.castShadow = !1),
        (Ye.receiveShadow = !0),
        Ye.instanceMatrix.setUsage(t.DynamicDrawUsage),
        Ye.parent || v.add(Ye));
      let zt = 0;
      const ht = Fe === "fast" ? 0.4 : 0.33;
      for (let Zt = 0; Zt < Math.floor(Jt / ht); Zt++)
        for (let bo = 0; bo < Math.floor(Jt / ht); bo++) {
          const go = l * Jt + (bo + 0.5) * ht,
            Co = j * Jt + (Zt + 0.5) * ht,
            Ao = go + (de(go, Co) - 0.5) * ht * 0.82,
            pn = Co + (de(go, Co, 2) - 0.5) * ht * 0.82;
          if (!K(Ao, pn)) continue;
          const bn = po(Ao, pn) + 0.006,
            en = g(Ao, pn)[3],
            Ln = 0.065 + en * 0.23 + de(Ao, pn, 4) * 0.03;
          if (zt < io) {
            const sa = de(go, Co, 3) * 6.283;
            Yo(Ye, zt++, Ao, bn, pn, Ln, sa, 0.96 + de(go, Co, 7) * 0.19, Math.floor(de(go, Co, 9) * 5), !0);
          }
        }
      return (
        (Ye.count = zt),
        (Ye.instanceMatrix.needsUpdate = !0),
        (Ye.instanceColor.needsUpdate = !0),
        (Ye.visible = zt > 0),
        (Ye.frustumCulled = !1),
        S.set(ze, { mesh: Ye, tx: l, tz: j }),
        ae.tilesBuilt++,
        (ae.tileBuildMs +=
          (((Et = (Yt = globalThis.performance) == null ? void 0 : Yt.now) == null ? void 0 : Et.call(Yt)) || ie) - ie),
        Ye
      );
    }
    function an(l = !1, j = 2) {
      const ie = kn(),
        ze = R.position.y - he(R.position.x, R.position.z);
      if ((A == null ? void 0 : A.dataset.mode) === "globe") ut.set(-7, 14);
      else if (ie != null && ie.enabled && ie.position) ut.set(ie.position.x, ie.position.z);
      else {
        R.getWorldDirection(It);
        const Zt = It.y < -0.08 ? Math.min(75, Math.max(0, ze) / -It.y) : 0;
        ut.set(R.position.x + It.x * Zt, R.position.z + It.z * Zt);
      }
      (Ut.subVectors(ut, Vt),
        Ut.length() > 4 ? Ut.set(0, 0) : Ut.multiplyScalar(16).clampLength(0, 8),
        Vt.copy(ut),
        eo.copy(ut).add(Ut),
        At.copy(ut));
      const Ye = ze > 72 || (A == null ? void 0 : A.dataset.mode) === "globe",
        zt = 3,
        ht = Math.floor(ut.x / Jt),
        Lt = Math.floor(ut.y / Jt),
        Qt = new Set(),
        Yt = [],
        Et = qe.uGroundRange21.value;
      if (!Ye)
        for (let Zt = -zt; Zt <= zt; Zt++)
          for (let bo = -zt; bo <= zt; bo++) {
            const go = ht + bo,
              Co = Lt + Zt;
            if (go * Jt > O.x1 || Co * Jt > O.z1 || (go + 1) * Jt < O.x0 || (Co + 1) * Jt < O.z0) continue;
            const Ao = go + ":" + Co;
            (Qt.add(Ao), Yt.push({ key: Ao, tx: go, tz: Co, d: ho(eo.x, eo.y, go * Jt, Co * Jt, Jt) }));
          }
      for (const [Zt, bo] of S)
        (l || (!Qt.has(Zt) && ho(ut.x, ut.y, bo.tx * Jt, bo.tz * Jt, Jt) > Et + 5)) &&
          ((bo.mesh.visible = !1), x.push(bo.mesh), S.delete(Zt));
      Yt.sort((Zt, bo) => Zt.d - bo.d);
      for (const Zt of Yt) !S.has(Zt.key) && j-- > 0 && jo(Zt.tx, Zt.tz);
      (R.updateMatrixWorld(),
        vo.multiplyMatrices(R.projectionMatrix, R.matrixWorldInverse),
        mo.setFromProjectionMatrix(vo),
        (ae.visibleGrassTiles = 0));
      for (const Zt of S.values()) {
        const bo = (Zt.tx + 0.5) * Jt,
          go = (Zt.tz + 0.5) * Jt,
          Co = po(bo, go);
        ((Zt.mesh.visible =
          !Ye &&
          Zt.mesh.count > 0 &&
          ho(ut.x, ut.y, Zt.tx * Jt, Zt.tz * Jt, Jt) < Et + 2.8 &&
          mo.intersectsSphere(new t.Sphere(new t.Vector3(bo, Co + 0.7, go), Jt * 0.74 + 2))),
          Zt.mesh.visible && ae.visibleGrassTiles++);
      }
      return (
        (ae.grassTiles = S.size),
        (ae.grassBlades = [...S.values()].reduce((Zt, bo) => Zt + bo.mesh.count * 4, 0)),
        (ae.grassCoverage = Math.max(V, Me)),
        (ae.nearCapacity = io),
        (ae.pendingTiles = Yt.filter((Zt) => !S.has(Zt.key)).length),
        (ae.cachedRadius27 = 24),
        ae.pendingTiles > 0
      );
    }
    function Eo() {
      var l;
      for (const j of S.values()) ((j.mesh.visible = !1), x.push(j.mesh));
      (S.clear(), fo && Ko(), (Ge = -1 / 0), (l = n.markDirty) == null || l.call(n));
    }
    async function tn(l) {
      ((Do = !0), w());
      const j = async () => {
        (ae.preloadYieldCount++, l ? await l() : await new Promise((ie) => setTimeout(ie, 0)));
      };
      do (an(!1, 3), await j());
      while (ae.pendingTiles > 0);
      Ko();
      for (let ie = 0; Oo.length; ie++) (Xo(Oo.shift()), ie % 2 === 1 && (await j()));
      return ((fo = !0), ln(), (ae.preloaded = !0), (Do = !1), ae);
    }
    const To = new t.PlaneGeometry(0.19, 0.36);
    To.rotateX(-Math.PI / 2);
    const _o = new Float32Array(pe);
    (_o.fill(-100), To.setAttribute("aStepBorn21", new t.InstancedBufferAttribute(_o, 1)));
    const fn = new t.ShaderMaterial({
        uniforms: { uStepTime21: X },
        transparent: !0,
        depthWrite: !1,
        depthTest: !0,
        polygonOffset: !0,
        polygonOffsetFactor: -2,
        vertexShader:
          "uniform float uStepTime21;attribute float aStepBorn21;varying vec2 vUv21;varying float vAge21;void main(){vUv21=uv;vAge21=uStepTime21-aStepBorn21;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}",
        fragmentShader: `varying vec2 vUv21;varying float vAge21;void main(){if(vAge21<0.||vAge21>1.5)discard;vec2 p=(vUv21-.5)*2.;float shape=1.-smoothstep(.55,1.,length(p));float fade=1.-smoothstep(.35,1.5,vAge21);float grain=.75+.25*sin(vUv21.y*43.);gl_FragColor=vec4(.12,.22,.075,shape*fade*grain*.27);
#include <tonemapping_fragment>
#include <encodings_fragment>
}`,
      }),
      Vo = new t.InstancedMesh(To, fn, pe);
    ((Vo.name = "Herbe_couchee_par_les_pas"),
      (Vo.userData.exportSkip = !0),
      (Vo.frustumCulled = !1),
      (Vo.renderOrder = 2),
      v.add(Vo));
    for (let l = 0; l < pe; l++) Vo.setMatrixAt(l, new t.Matrix4().makeTranslation(0, -500, 0));
    function Mn(l, j, ie, ze = {}) {
      if (!K(l, j)) return !1;
      const Ye = X.value,
        zt = ze.wheel ? 0.4 : 0.33,
        ht = ze.halfLength || 0;
      return (
        c[ft].set(l, j, Ye, ie),
        P[ft].set(zt, ht, ze.wheel ? 1 : 0.95),
        (_o[ft] = Ye),
        et.set(l, T(l, j) + 0.012, j),
        M.setFromAxisAngle(ge, ie),
        ee.compose(et, M, kt.set(ze.wheel ? 1.8 : 1, 1, ze.wheel ? Math.max(1.2, (ht * 2) / 0.36) : 1)),
        Vo.setMatrixAt(ft, ee),
        (Vo.instanceMatrix.needsUpdate = !0),
        (To.attributes.aStepBorn21.needsUpdate = !0),
        (ft = (ft + 1) % pe),
        ze.wheel ? ae.quadContacts++ : ae.footsteps++,
        !0
      );
    }
    const So = 192,
      ia = 72,
      on = Array(So).fill(null),
      Ro = new Float32Array(So * 2),
      cn = C;
    let Io = 0,
      Dn = 0;
    for (let l = 0; l < So; l++) Ro[l * 2] = -1e3;
    function wn() {
      var j, ie, ze, Ye, zt, ht, Lt, Qt, Yt;
      const l =
        ((j = n.getWeatherState) == null ? void 0 : j.call(n)) ||
        (typeof n.weather == "function" ? n.weather() : n.weather) ||
        {};
      return {
        snow: le(
          Number(
            ((ze = (ie = l.uniforms) == null ? void 0 : ie.snow) == null ? void 0 : ze.value) ??
              l.snow ??
              (l.mode === "snow" ? 1 : 0),
          ) || 0,
          0,
          1,
        ),
        night:
          Number(((zt = (Ye = l.uniforms) == null ? void 0 : Ye.night) == null ? void 0 : zt.value) ?? l.night) || 0,
        rain: le(
          Number(
            ((Lt = (ht = l.uniforms) == null ? void 0 : ht.rain) == null ? void 0 : Lt.value) ??
              l.rain ??
              (l.mode === "rain" ? 1 : 0),
          ) || 0,
          0,
          1,
        ),
        wet: le(
          Number(
            ((Yt = (Qt = l.uniforms) == null ? void 0 : Qt.wet) == null ? void 0 : Yt.value) ??
              l.wet ??
              (l.mode === "rain" ? 1 : 0),
          ) || 0,
          0,
          1,
        ),
        mode: l.mode || "sun",
      };
    }
    const No = new t.BufferGeometry(),
      rn = [],
      Bn = [],
      mn = [
        [-0.056, -0.164],
        [-0.087, -0.126],
        [-0.087, -0.073],
        [-0.066, -0.034],
        [-0.071, 0.03],
        [-0.092, 0.09],
        [-0.083, 0.139],
        [-0.054, 0.171],
        [0.015, 0.181],
        [0.068, 0.154],
        [0.089, 0.101],
        [0.08, 0.034],
        [0.059, -0.028],
        [0.065, -0.086],
        [0.068, -0.137],
        [0.03, -0.166],
      ],
      Hn = [
        { scale: 0.85, y: 0.006, color: [0.28, 0.4, 0.51] },
        { scale: 1, y: 0.011, color: [0.42, 0.55, 0.65] },
        { scale: 1.2, y: 0.043, color: [0.76, 0.86, 0.93] },
        { scale: 1.46, y: 0.004, color: [0.81, 0.89, 0.95] },
      ];
    function sn(l, j) {
      const ie = mn[j % mn.length],
        ze = Hn[l],
        Ye = 1 + Math.sin(j * 2.39 + l * 4.7) * 0.035;
      return {
        p: [ie[0] * ze.scale, ze.y * (l === 2 ? 1 + Math.sin(j * 2.3) * 0.17 : 1), ie[1] * ze.scale],
        c: ze.color.map((zt) => zt * Ye),
      };
    }
    function Qo(l, j, ie) {
      for (const ze of [l, j, ie]) (rn.push(...ze.p), Bn.push(...ze.c));
    }
    for (let l = 0; l < mn.length; l++) {
      const j = (l + 1) % mn.length;
      Qo({ p: [0, 0.005, 0], c: [0.27, 0.39, 0.51] }, sn(0, l), sn(0, j));
      for (let ie = 0; ie < Hn.length - 1; ie++) {
        const ze = sn(ie, l),
          Ye = sn(ie, j),
          zt = sn(ie + 1, l),
          ht = sn(ie + 1, j);
        (Qo(ze, zt, Ye), Qo(Ye, zt, ht));
      }
    }
    (No.setAttribute("position", new t.Float32BufferAttribute(rn, 3)),
      No.setAttribute("color", new t.Float32BufferAttribute(Bn, 3)),
      No.setAttribute("aSnowContact22", new t.InstancedBufferAttribute(Ro, 2)),
      No.computeVertexNormals());
    const un = new t.MeshLambertMaterial({
      color: 16777215,
      vertexColors: !0,
      side: t.DoubleSide,
      polygonOffset: !0,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    ((un.name = "weather"),
      (un.userData.snowFootprints22 = !0),
      (un.userData.noWeatherPaint22 = !0),
      (un.onBeforeCompile = (l) => {
        ((l.uniforms.uSnowStepTime22 = X),
          (l.uniforms.uSnowCover22 = cn),
          (l.vertexShader =
            `attribute vec2 aSnowContact22;uniform float uSnowStepTime22;varying float vSnowStepAge22;
` + l.vertexShader),
          (l.vertexShader = l.vertexShader
            .replace(
              "#include <begin_vertex>",
              `#include <begin_vertex>
transformed.x*=aSnowContact22.y;vSnowStepAge22=uSnowStepTime22-aSnowContact22.x;`,
            )
            .replace(
              "#include <beginnormal_vertex>",
              `#include <beginnormal_vertex>
objectNormal.x*=aSnowContact22.y;`,
            )
            .replace(
              "#include <lights_lambert_vertex>",
              `#include <lights_lambert_vertex>
#ifdef DOUBLE_SIDED
if(aSnowContact22.y<0.){vec3 snowFront22=vLightFront;vLightFront=vLightBack;vLightBack=snowFront22;vec3 snowIndirect22=vIndirectFront;vIndirectFront=vIndirectBack;vIndirectBack=snowIndirect22;}
#endif`,
            )),
          (l.fragmentShader =
            `uniform float uSnowCover22;varying float vSnowStepAge22;
` + l.fragmentShader),
          (l.fragmentShader = l.fragmentShader.replace(
            "#include <clipping_planes_fragment>",
            `#include <clipping_planes_fragment>
if(vSnowStepAge22<0.||vSnowStepAge22>72.)discard;float footprintFade22=(1.-smoothstep(52.,72.,vSnowStepAge22))*smoothstep(.16,.58,uSnowCover22);float footprintNoise22=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);if(footprintNoise22>footprintFade22)discard;`,
          )));
      }),
      (un.customProgramCacheKey = () => "moulin-snow-footprints22"));
    const Go = new t.InstancedMesh(No, un, So);
    ((Go.name = "Empreintes_creuses_dans_la_neige"),
      (Go.userData.exportSkip = !0),
      (Go.frustumCulled = !1),
      (Go.receiveShadow = !0),
      (Go.castShadow = !1),
      (Go.visible = !1),
      (Go.count = 0),
      Go.instanceMatrix.setUsage(t.DynamicDrawUsage),
      v.add(Go));
    for (let l = 0; l < So; l++) Go.setMatrixAt(l, new t.Matrix4().makeTranslation(0, -500, 0));
    function kn() {
      return typeof n.player == "function" ? n.player() : n.player;
    }
    function xn(l, j) {
      var Lt, Qt, Yt, Et;
      if (!Number.isFinite(l) || !Number.isFinite(j) || l < O.x0 || l > O.x1 || j < O.z0 || j > O.z1) return null;
      const ie = kn(),
        ze =
          ((Lt = n.surfaceInfo) == null ? void 0 : Lt.call(n, l, j)) ||
          ((Qt = ie == null ? void 0 : ie.surfaceInfo) == null ? void 0 : Qt.call(ie, l, j)),
        Ye =
          (ze == null ? void 0 : ze.bridge) ||
          ((Yt = ie == null ? void 0 : ie.bridgeAt) == null ? void 0 : Yt.call(ie, l, j));
      if ((ze == null ? void 0 : ze.type) === "water" || (!ze && !Ye && te != null && te([l, j], 0))) return null;
      const zt = Number.isFinite(ze == null ? void 0 : ze.height) ? ze.height : T(l, j);
      if (!Number.isFinite(zt)) return null;
      const ht = (Et = n.snowSurfaceAt) == null ? void 0 : Et.call(n, l, j, zt);
      return ht === !1
        ? null
        : { y: zt + (Number.isFinite(ht) ? ht : 0), surface: (ze == null ? void 0 : ze.type) || "land" };
    }
    function hn(l, j, ie, ze = {}) {
      var go, Co, Ao;
      const Ye = ((Co = (go = kn()) == null ? void 0 : go.getAudioState) == null ? void 0 : Co.call(go)) || {};
      if (Ye.vehicle || Ye.grounded === !1 || cn.value < 0.24) return !1;
      const zt = xn(l, j);
      if (!zt) return !1;
      const ht = ze.side === 1 ? 1 : -1,
        Lt = X.value,
        Qt = Io,
        Yt = { x: l, z: j, y: zt.y, angle: ie, side: ht, born: Lt, landing: !!ze.landing };
      ((on[Qt] = Yt), (Ro[Qt * 2] = Lt), (Ro[Qt * 2 + 1] = ht));
      const Et = (pn, bn) => {
          var en;
          return ((en = xn(pn, bn)) == null ? void 0 : en.y) ?? zt.y;
        },
        Zt = le(Et(l + 0.12, j) - Et(l - 0.12, j), -0.13, 0.13) / 0.24,
        bo = le(Et(l, j + 0.12) - Et(l, j - 0.12), -0.13, 0.13) / 0.24;
      return (
        M.setFromUnitVectors(ge, new t.Vector3(-Zt, 1, -bo).normalize()),
        M.multiply(new t.Quaternion().setFromAxisAngle(ge, ie)),
        et.set(l, zt.y + 0.014, j),
        kt.setScalar(ze.landing ? 1.07 : 1),
        ee.compose(et, M, kt),
        Go.setMatrixAt(Qt, ee),
        (Go.count = Math.max(Go.count, Qt + 1)),
        (Go.instanceMatrix.needsUpdate = !0),
        (No.attributes.aSnowContact22.needsUpdate = !0),
        (Io = (Qt + 1) % So),
        ae.footsteps++,
        ae.snowFootsteps++,
        (Ao = n.markDirty) == null || Ao.call(n),
        !0
      );
    }
    function Gn() {
      (on.fill(null), (Io = 0), (Go.count = 0));
      for (let l = 0; l < So; l++) Ro[l * 2] = -1e3;
      ((No.attributes.aSnowContact22.needsUpdate = !0), (Go.visible = !1), (ae.activeSnowFootprints = 0));
    }
    const dn = 144,
      _n = 48,
      zn = Array(dn).fill(null),
      An = new Float32Array(dn * 2),
      Xn = { value: 0 };
    let Fn = 0;
    for (let l = 0; l < dn; l++) An[l * 2] = -1e3;
    const nn = No.clone();
    (nn.deleteAttribute("aSnowContact22"), nn.setAttribute("aMudContact23", new t.InstancedBufferAttribute(An, 2)));
    const gn = nn.attributes.position,
      ea = nn.attributes.color;
    for (let l = 0; l < gn.count; l++) {
      const j = gn.getY(l),
        ie = j > 0.022;
      (gn.setY(l, j * 0.23), ea.setXYZ(l, ie ? 0.2 : 0.115, ie ? 0.127 : 0.064, ie ? 0.066 : 0.026));
    }
    nn.computeVertexNormals();
    const Sn = new t.MeshLambertMaterial({
      color: 16777215,
      vertexColors: !0,
      side: t.DoubleSide,
      polygonOffset: !0,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -2,
    });
    ((Sn.name = "weather"),
      (Sn.userData.noWeatherPaint22 = !0),
      (Sn.onBeforeCompile = (l) => {
        ((l.uniforms.uMudTime23 = X),
          (l.vertexShader =
            `uniform float uMudTime23;attribute vec2 aMudContact23;varying float vMudAge23;varying vec2 vMudSole23;
` + l.vertexShader),
          (l.vertexShader = l.vertexShader
            .replace(
              "#include <begin_vertex>",
              `#include <begin_vertex>
transformed.x*=aMudContact23.y;vMudAge23=uMudTime23-aMudContact23.x;vMudSole23=position.xz;`,
            )
            .replace(
              "#include <beginnormal_vertex>",
              `#include <beginnormal_vertex>
objectNormal.x*=aMudContact23.y;`,
            )
            .replace(
              "#include <lights_lambert_vertex>",
              `#include <lights_lambert_vertex>
#ifdef DOUBLE_SIDED
if(aMudContact23.y<0.){vec3 mf23=vLightFront;vLightFront=vLightBack;vLightBack=mf23;vec3 mi23=vIndirectFront;vIndirectFront=vIndirectBack;vIndirectBack=mi23;}
#endif`,
            )),
          (l.fragmentShader =
            `varying float vMudAge23;varying vec2 vMudSole23;
` + l.fragmentShader),
          (l.fragmentShader = l.fragmentShader.replace(
            "#include <clipping_planes_fragment>",
            `#include <clipping_planes_fragment>
if(vMudAge23<0.||vMudAge23>48.)discard;float mf23=1.-smoothstep(24.,48.,vMudAge23);float mn23=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);if(mn23>mf23)discard;`,
          )),
          (l.fragmentShader = l.fragmentShader.replace(
            "#include <color_fragment>",
            `#include <color_fragment>
float tread23=step(.50,fract(vMudSole23.y*28.))*step(abs(vMudSole23.x),.060);diffuseColor.rgb*=1.+tread23*.58;`,
          )));
      }),
      (Sn.customProgramCacheKey = () => "moulin-mud-footprints23"));
    const Jo = new t.InstancedMesh(nn, Sn, dn);
    ((Jo.name = "Empreintes_des_bottes_dans_la_terre_humide"),
      (Jo.userData.exportSkip = !0),
      (Jo.frustumCulled = !1),
      (Jo.receiveShadow = !0),
      (Jo.castShadow = !1),
      (Jo.visible = !1),
      (Jo.count = 0),
      Jo.instanceMatrix.setUsage(t.DynamicDrawUsage),
      v.add(Jo));
    function Cn() {
      (zn.fill(null), (Fn = 0), (Jo.count = 0), (Jo.visible = !1), (ae.activeMudFootprints = 0));
      for (let l = 0; l < dn; l++) An[l * 2] = -1e3;
      nn.attributes.aMudContact23.needsUpdate = !0;
    }
    function Zn(l, j, ie, ze = {}) {
      var Ao, pn, bn;
      const Ye = ((pn = (Ao = kn()) == null ? void 0 : Ao.getAudioState) == null ? void 0 : pn.call(Ao)) || {},
        zt = xn(l, j);
      if (Ye.vehicle || Ye.grounded === !1 || !zt || Xn.value < 0.22 || cn.value > 0.12) return !1;
      const ht = K(l, j),
        Lt = String(Ye.surface || zt.surface || "").toLowerCase();
      if (
        !(ht || /grass|earth|dirt|leaf|terre|herbe|feuille|gravel|gravier/.test(Lt)) ||
        zt.surface === "bridge" ||
        (n.footprintDistance && (n.foundationFootprints || []).some((en) => n.footprintDistance(l, j, en) < 0.03))
      )
        return !1;
      const Yt = ze.side === 1 ? 1 : -1,
        Et = Fn,
        Zt = X.value,
        bo = (en, Ln) => {
          var sa;
          return ((sa = xn(en, Ln)) == null ? void 0 : sa.y) ?? zt.y;
        },
        go = le(bo(l + 0.12, j) - bo(l - 0.12, j), -0.12, 0.12) / 0.24,
        Co = le(bo(l, j + 0.12) - bo(l, j - 0.12), -0.12, 0.12) / 0.24;
      return (
        (zn[Et] = { x: l, z: j, y: zt.y, angle: ie, side: Yt, born: Zt }),
        (An[Et * 2] = Zt),
        (An[Et * 2 + 1] = Yt),
        M.setFromUnitVectors(ge, new t.Vector3(-go, 1, -Co).normalize()),
        M.multiply(new t.Quaternion().setFromAxisAngle(ge, ie)),
        et.set(l, zt.y + 0.014, j),
        kt.setScalar(ze.landing ? 1.1 : 1),
        ee.compose(et, M, kt),
        Jo.setMatrixAt(Et, ee),
        (Jo.count = Math.max(Jo.count, Et + 1)),
        (Jo.instanceMatrix.needsUpdate = !0),
        (nn.attributes.aMudContact23.needsUpdate = !0),
        (Fn = (Fn + 1) % dn),
        ae.mudFootsteps++,
        (bn = n.markDirty) == null || bn.call(n),
        !0
      );
    }
    function f(l, j, ie, ze = {}) {
      var Lt, Qt;
      const Ye = ((Qt = (Lt = kn()) == null ? void 0 : Lt.getAudioState) == null ? void 0 : Qt.call(Lt)) || {};
      if (Ye.vehicle || Ye.grounded === !1) return !1;
      if (cn.value >= 0.24) return hn(l, j, ie, ze);
      const zt = Mn(l, j, ie, ze),
        ht = Zn(l, j, ie, ze);
      return zt || ht;
    }
    function J(l, j, ie) {
      if (!l.vehicle || l.grounded === !1) {
        Re = null;
        return;
      }
      if (X.value - me < 0.105) return;
      me = X.value;
      let ze = Array.isArray(l.wheelContacts)
        ? l.wheelContacts.filter((Ye) => Ye && Ye.grounded !== !1 && Number.isFinite(Ye.x) && Number.isFinite(Ye.z))
        : [];
      (ze.length >= 4 &&
        (ze = ze
          .slice()
          .sort(
            (Ye, zt) =>
              (Ye.x - j.x) * Math.sin(ie) +
              (Ye.z - j.z) * Math.cos(ie) -
              ((zt.x - j.x) * Math.sin(ie) + (zt.z - j.z) * Math.cos(ie)),
          )
          .slice(0, 2)),
        ze.length < 2 &&
          (ze = [-1, 1].map((Ye) => ({
            x: j.x + Math.cos(ie) * Ye * 0.56 - Math.sin(ie) * 0.68,
            z: j.z - Math.sin(ie) * Ye * 0.56 - Math.cos(ie) * 0.68,
          }))),
        ze.sort(
          (Ye, zt) =>
            (Ye.x - j.x) * Math.cos(ie) -
            (Ye.z - j.z) * Math.sin(ie) -
            ((zt.x - j.x) * Math.cos(ie) - (zt.z - j.z) * Math.sin(ie)),
        ),
        ze.forEach((Ye, zt) => {
          const ht = Re == null ? void 0 : Re[zt],
            Lt = ht ? Math.hypot(Ye.x - ht.x, Ye.z - ht.z) : 0;
          if (ht && Lt < 3) {
            const Qt = Lt > 0.03 ? Math.atan2(Ye.x - ht.x, Ye.z - ht.z) : ie;
            Mn((Ye.x + ht.x) * 0.5, (Ye.z + ht.z) * 0.5, Qt, { wheel: !0, halfLength: Lt * 0.5 + 0.18 });
          } else Mn(Ye.x, Ye.z, ie, { wheel: !0, halfLength: 0.22 });
        }),
        (Re = ze.map((Ye) => ({ x: Ye.x, z: Ye.z }))));
    }
    function Ze(l, j, ie, ze, Ye = {}) {
      const zt = 0.105 * ze,
        ht = Ye.landing ? 0.035 : Ye.running ? 0.19 : 0.13;
      return f(l + Math.cos(ie) * zt + Math.sin(ie) * ht, j - Math.sin(ie) * zt + Math.cos(ie) * ht, ie + ze * 0.035, {
        ...Ye,
        side: ze,
      });
    }
    function Je(l) {
      var Lt, Qt;
      const j = kn();
      if (!(j != null && j.enabled)) {
        ((m = null), (Re = null), (at = 0));
        return;
      }
      const ie = ((Lt = j.getAudioState) == null ? void 0 : Lt.call(j)) || {},
        ze = ie.position || j.position;
      if (!ze || !Number.isFinite(ze.x) || !Number.isFinite(ze.z)) return;
      const Ye = Number.isFinite(ie.stepPhase) ? ie.stepPhase : null,
        zt = ie.grounded !== !1,
        ht = { x: ze.x, z: ze.z, grounded: zt, phase: Ye, vehicle: !!ie.vehicle };
      if (m) {
        const Yt = ze.x - m.x,
          Et = ze.z - m.z,
          Zt = Math.hypot(Yt, Et),
          bo = Zt > Math.max(1, Math.min(0.25, Math.max(0.001, l)) * (ie.vehicle ? 28 : 12)),
          go = Number.isFinite(ie.facing)
            ? ie.facing
            : Number.isFinite((Qt = j.actor) == null ? void 0 : Qt.rotation.y)
              ? j.actor.rotation.y
              : Zt > 1e-5
                ? Math.atan2(Yt, Et)
                : 0;
        if (ie.vehicle || !zt || bo)
          ((at = 0),
            bo
              ? (Re = null)
              : ie.vehicle
                ? J(ie, ze, Number.isFinite(ie.vehicleFacing) ? ie.vehicleFacing : go)
                : (Re = null));
        else if (!m.grounded && !m.vehicle)
          (Ze(ze.x, ze.z, go, -1, { landing: !0 }), Ze(ze.x, ze.z, go, 1, { landing: !0 }), (at = 0));
        else if (Zt > 1e-4 && !m.vehicle) {
          const Co = Ye !== null && m.phase !== null ? Ye - m.phase : 0;
          if (Co > 0 && Co < Math.PI * 6) {
            const Ao = Math.floor(m.phase / Math.PI) + 1,
              pn = Math.floor(Ye / Math.PI);
            for (let bn = Ao; bn <= pn && bn < Ao + 4; bn++) {
              const en = le((bn * Math.PI - m.phase) / Co, 0, 1),
                Ln = bn % 2 ? 1 : -1;
              Ze(m.x + Yt * en, m.z + Et * en, go, Ln, { running: !!ie.running });
            }
            at = 0;
          } else {
            const Ao = ie.running ? 0.78 : 0.56,
              pn = at;
            at += Zt;
            let bn = Ao - pn,
              en = 0;
            for (; at >= Ao && en++ < 4; ) {
              ue *= -1;
              const Ln = le(bn / Zt, 0, 1);
              (Ze(m.x + Yt * Ln, m.z + Et * Ln, go, ue, { running: !!ie.running }), (at -= Ao), (bn += Ao));
            }
          }
        }
      }
      m = ht;
    }
    const ct = (n.smokeOrigins || []).map((l) => (Array.isArray(l) ? new t.Vector3(...l) : l.clone())),
      gt = 96,
      Gt = new t.InstancedBufferGeometry();
    (Gt.setAttribute(
      "position",
      new t.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3),
    ),
      Gt.setAttribute("uv", new t.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2)),
      Gt.setIndex([0, 1, 2, 0, 2, 3]));
    const Ot = new Float32Array(gt * 3),
      Xt = new Float32Array(gt);
    for (let l = 0; l < gt; l++) {
      const j = Math.max(1, ct.length),
        ie = ct[l % j] || new t.Vector3(0, -500, 0);
      (Ot.set(ie.toArray(), l * 3), (Xt[l] = (Math.floor(l / j) + (l % j) * 0.37) / (gt / j)));
    }
    (Gt.setAttribute("aSmokeOrigin21", new t.InstancedBufferAttribute(Ot, 3)),
      Gt.setAttribute("aSmokePhase21", new t.InstancedBufferAttribute(Xt, 1)));
    const Wt = new t.ShaderMaterial({
        uniforms: {
          uSmokeTime21: X,
          uSmokeWind21: a,
          uSmokeDirection21: _e,
          uSmokePhaseScale21: { value: 1 },
          uSmokeLight21: { value: 1 },
        },
        transparent: !0,
        depthWrite: !1,
        depthTest: !0,
        vertexShader:
          "uniform float uSmokeTime21,uSmokeWind21,uSmokePhaseScale21;uniform vec2 uSmokeDirection21;attribute vec3 aSmokeOrigin21;attribute float aSmokePhase21;varying vec2 vSmokeUv21;varying float vSmokeAge21;varying float vSmokeSeed24;void main(){float a=fract(uSmokeTime21*.073+aSmokePhase21*uSmokePhaseScale21);vSmokeAge21=a;vSmokeUv21=uv;vSmokeSeed24=aSmokePhase21*27.;vec3 p=aSmokeOrigin21;float wind24=pow(clamp(uSmokeWind21,0.,1.8),.80),gust24=.76+.24*sin(uSmokeTime21*.73-a*4.7);p.y+=.10+a*(8.3-wind24*2.5);vec2 lateral=vec2(-uSmokeDirection21.y,uSmokeDirection21.x);p.xz+=uSmokeDirection21*((a*.45+a*a*13.5)*wind24*gust24)+lateral*sin(a*10.5+aSmokePhase21*17.-uSmokeTime21*.28)*a*(.20+wind24*.66);p.y+=sin(a*12.+aSmokePhase21*15.-uSmokeTime21*.30)*a*.22;vec4 v=modelViewMatrix*vec4(p,1.);float rotation=sin(aSmokePhase21*41.)*3.14+uSmokeTime21*(.04+wind24*.09),c=cos(rotation),s=sin(rotation);vec2 q=mat2(c,-s,s,c)*position.xy;v.xy+=q*(.44+pow(a,.82)*(2.5+wind24*.55));gl_Position=projectionMatrix*v;}",
        fragmentShader: `uniform float uSmokeLight21;varying vec2 vSmokeUv21;varying float vSmokeAge21;varying float vSmokeSeed24;
float smokeHash24(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float smokeNoise24(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(smokeHash24(i),smokeHash24(i+vec2(1.,0.)),f.x),mix(smokeHash24(i+vec2(0.,1.)),smokeHash24(i+vec2(1.)),f.x),f.y);}
void main(){vec2 p=vSmokeUv21*2.-1.;float n=smokeNoise24(p*3.8+vSmokeSeed24),detail=smokeNoise24(p*8.1-vSmokeSeed24*.67);float cloud=1.-smoothstep(.18,1.,length(p)+(n-.5)*.28);float age=smoothstep(0.,.045,vSmokeAge21)*(1.-smoothstep(.46,1.,vSmokeAge21));float alpha=cloud*age*(.27+.14*n)*(.74+.26*detail);if(alpha<.005)discard;float light=.15+.85*uSmokeLight21;vec3 soot=mix(vec3(.29,.305,.29),vec3(.58,.59,.555),smoothstep(.04,.64,vSmokeAge21));soot*=light*(.86+.22*n);gl_FragColor=vec4(soot,alpha);
#include <tonemapping_fragment>
#include <encodings_fragment>
}`,
      }),
      i = new t.Mesh(Gt, Wt);
    ((i.name = "Fumee_visible_des_deux_cheminees"),
      (i.frustumCulled = !1),
      (i.userData.exportSkip = !0),
      (i.renderOrder = 4),
      v.add(i));
    function d(l) {
      var ie;
      ((Ve = !!l), (i.visible = Ve && ct.length > 0));
      const j = A == null ? void 0 : A.querySelector("[data-smoke21]");
      j && (j.checked = Ve);
      try {
        const ze = JSON.parse(localStorage.getItem("moulin-settings-v20") || "{}");
        ((ze.smoke = Ve), localStorage.setItem("moulin-settings-v20", JSON.stringify(ze)));
      } catch {}
      return ((ae.smokeEnabled = Ve), (ie = n.markDirty) == null || ie.call(n), Ve);
    }
    try {
      Ve = JSON.parse(localStorage.getItem("moulin-settings-v20") || "{}").smoke !== !1;
    } catch {}
    const Z = A == null ? void 0 : A.querySelector("[data-smoke21]"),
      ye = () => d(Z.checked);
    Z == null || Z.addEventListener("change", ye);
    function nt(l) {
      return (
        (Fe = l === "fast" || q ? "fast" : l === "detail" ? "detail" : "balanced"),
        (qe.uGroundRange21.value = Fe === "fast" ? 14 : 18),
        (qe.uGroundMeadowRange25.value = Fe === "fast" ? 58 : 78),
        (ae.nearLimit = qe.uGroundRange21.value),
        (ae.meadowLimit = qe.uGroundMeadowRange25.value),
        (Gt.instanceCount = Fe === "fast" ? 48 : gt),
        (Wt.uniforms.uSmokePhaseScale21.value = Fe === "fast" ? 2 : 1),
        (ae.smokePuffs = ct.length ? Gt.instanceCount : 0),
        Eo(),
        Fe
      );
    }
    function xt(l, j = 0.033) {
      var zt;
      if (pt) return !1;
      ((X.value = Number.isFinite(l) ? l : X.value + j), (se = X.value));
      const ie = wn();
      ((cn.value = ie.snow),
        (Xn.value = Math.max(ie.wet, ie.rain)),
        Dn >= 0.015 && cn.value < 0.015 && Gn(),
        (Dn = cn.value),
        Qe || (Qe = ((zt = re.parent) == null ? void 0 : zt.children.find((ht) => ht.isHemisphereLight)) || null),
        Qe && (Wt.uniforms.uSmokeLight21.value = le(Qe.intensity / 0.9, 0.06, 1)));
      const ze = performance.now() * 0.001;
      (ze - E > 0.4 && ((E = ze), w()),
        Je(j),
        ze - Ge > 0.032 && ((Ge = ze), an(!1, 2), Oo.length && Xo(Oo.shift())),
        ln());
      const Ye = c.some((ht) => X.value - ht.z >= 0 && X.value - ht.z < 1.5);
      return (
        (qe.uGroundHasContacts26.value = Ye ? 1 : 0),
        (Vo.visible = Ye && cn.value < 0.24),
        (ae.activeSnowFootprints = on.reduce(
          (ht, Lt) => ht + (Lt && X.value - Lt.born >= 0 && X.value - Lt.born < ia ? 1 : 0),
          0,
        )),
        (Go.visible = cn.value > 0.015 && ae.activeSnowFootprints > 0),
        (ae.activeMudFootprints = zn.reduce(
          (ht, Lt) => ht + (Lt && X.value - Lt.born >= 0 && X.value - Lt.born < _n ? 1 : 0),
          0,
        )),
        (Jo.visible = cn.value < 0.15 && ae.activeMudFootprints > 0),
        (ae.extraDrawCalls =
          ae.visibleGrassTiles +
          ae.visibleMeadowTiles +
          (Vo.visible ? 1 : 0) +
          (Go.visible ? 1 : 0) +
          (Jo.visible ? 1 : 0) +
          (i.visible ? 1 : 0)),
        vt++,
        Ye || Go.visible || Jo.visible || i.visible || a.value > 0.001
      );
    }
    function ot() {
      var l, j, ie;
      ((pt = !0), Z == null || Z.removeEventListener("change", ye));
      for (const ze of [...S.values()].map((Ye) => Ye.mesh).concat(x))
        (ze.geometry.dispose(), (l = ze.dispose) == null || l.call(ze));
      (re.remove(v), Rt.dispose(), oo.dispose());
      for (const ze of zo.values()) (ze.mesh.geometry.dispose(), (ie = (j = ze.mesh).dispose) == null || ie.call(j));
      (Oe.dispose(),
        Q.dispose(),
        Ce.dispose(),
        B.dispose(),
        To.dispose(),
        fn.dispose(),
        No.dispose(),
        un.dispose(),
        nn.dispose(),
        Sn.dispose(),
        Gt.dispose(),
        Wt.dispose(),
        ve.dispose(),
        h.forEach((ze) => ze.dispose()));
    }
    return (
      nt(Fe),
      d(Ve),
      {
        group: v,
        update: xt,
        prepare27: tn,
        setQuality: nt,
        syncTerrain: Eo,
        syncPaths: w,
        setTerrainClearedRegions: Ee,
        exportClearRegions: () => JSON.parse(JSON.stringify(Le)),
        setSmokeEnabled: d,
        leaveStep: f,
        leaveVehicleContact: (l, j, ie, ze = 0.2) => Mn(l, j, ie, { wheel: !0, halfLength: ze }),
        clearSnowFootprints: Gn,
        clearMudFootprints: Cn,
        getMudFootprints: () =>
          zn.filter((l) => l && X.value - l.born >= 0 && X.value - l.born < _n).map((l) => ({ ...l })),
        getSnowFootprints: () =>
          on.filter((l) => l && X.value - l.born >= 0 && X.value - l.born < ia).map((l) => ({ ...l })),
        grassAllowed: K,
        grassHeight: po,
        refreshGrass: () => an(!1, 2),
        getGrassTiles: () =>
          [...S.values()].map((l) => ({ tx: l.tx, tz: l.tz, count: l.mesh.count, visible: l.mesh.visible })),
        getMeadowTiles27: () =>
          [...zo.values()].map((l) => ({ tx: l.tx, tz: l.tz, count: l.mesh.count, visible: l.mesh.visible })),
        isCleared: ne,
        mask: ve,
        turfTexture26: Ce,
        fieldTexture28: B,
        sampleField28: (l, j) => Array.from(g(l, j)),
        uniforms: qe,
        reflectionHidden: [v],
        dispose: ot,
        stats: ae,
        get smokeEnabled() {
          return Ve;
        },
      }
    );
  }),
  (function () {
    "use strict";
    const t = new WeakMap();
    ((globalThis.MoulinLoadAvatar22 = async function (n) {
      if (t.has(n)) return t.get(n);
      const A = (async () => {
        const re = await fetch(globalThis.MoulinHost30.avatar);
        if (!re.ok) throw Error("Le personnage n\u2019a pas pu \xEAtre t\xE9l\xE9charg\xE9. Recharge la page.");
        const R = new Uint8Array(await globalThis.MoulinHost30.binary(re)),
          he = new DataView(R.buffer);
        if (he.getUint32(0, !0) !== 1179937895) throw new Error("Avatar V21 : GLB invalide");
        const te = he.getUint32(12, !0),
          O = JSON.parse(new TextDecoder().decode(R.subarray(20, 20 + te))),
          T = R.subarray(28 + te),
          le = { 5126: Float32Array, 5123: Uint16Array, 5125: Uint32Array, 5121: Uint8Array },
          X = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 },
          a = (pe) => {
            const q = O.accessors[pe],
              v = O.bufferViews[q.bufferView],
              k = le[q.componentType],
              h = v.byteOffset + (q.byteOffset || 0);
            return {
              array: new k(
                T.buffer.slice(T.byteOffset + h, T.byteOffset + h + q.count * X[q.type] * k.BYTES_PER_ELEMENT),
              ),
              size: X[q.type],
              normalized: !!q.normalized,
            };
          },
          _e = await Promise.all(
            (O.images || []).map(
              (pe) =>
                new Promise((q, v) => {
                  const k = O.bufferViews[pe.bufferView],
                    h = T.subarray(k.byteOffset, k.byteOffset + k.byteLength),
                    b = URL.createObjectURL(new Blob([h], { type: pe.mimeType }));
                  new n.TextureLoader().load(
                    b,
                    (p) => {
                      (URL.revokeObjectURL(b),
                        (p.flipY = !1),
                        n.SRGBColorSpace ? (p.colorSpace = n.SRGBColorSpace) : (p.encoding = n.sRGBEncoding),
                        (p.anisotropy = 2),
                        q(p));
                    },
                    void 0,
                    (p) => {
                      (URL.revokeObjectURL(b), v(p));
                    },
                  );
                }),
            ),
          );
        return {
          doc: O,
          accessor: a,
          textures: _e,
          source: "Quaternius Universal Base Characters + Universal Animation Library (CC0)",
          bytes: R.length,
        };
      })();
      return (t.set(n, A), A);
    }),
      (globalThis.MoulinAvatar22 = function (n, { asset: A }) {
        if (!A) throw new Error("Le mod\xE8le humain V21 doit \xEAtre charg\xE9 avant de cr\xE9er le personnage.");
        const { doc: re, accessor: R, textures: he } = A,
          te = new n.Group();
        ((te.name = "Visiteur_modele_humain_importe"), (te.userData.exportSkip = !0));
        const O = new n.Group();
        ((O.name = "Rig_Quaternius_adapte"), te.add(O));
        const T = 1.75 / 1.84;
        O.scale.set(T * 0.93, T, T);
        const le = new Set(re.skins.flatMap((we) => we.joints)),
          X = re.nodes.map((we, We) => {
            const yt = le.has(We) ? new n.Bone() : new n.Group();
            return (
              (yt.name = we.name || "avatar_node_" + We),
              we.translation && yt.position.fromArray(we.translation),
              we.rotation && yt.quaternion.fromArray(we.rotation),
              we.scale && yt.scale.fromArray(we.scale),
              yt
            );
          });
        re.nodes.forEach((we, We) => {
          for (const yt of we.children || []) X[We].add(X[yt]);
        });
        for (const we of re.scenes[re.scene || 0].nodes) O.add(X[we]);
        const a = re.materials.map((we) => {
          const We = we.pbrMetallicRoughness || {},
            yt = We.baseColorFactor || [1, 1, 1, 1];
          return new n.MeshStandardMaterial({
            name: we.name,
            color: new n.Color(yt[0], yt[1], yt[2]),
            map: We.baseColorTexture ? he[re.textures[We.baseColorTexture.index].source] : null,
            roughness: We.roughnessFactor ?? 0.86,
            metalness: 0,
            side: n.FrontSide,
          });
        });
        a.forEach((we) => (we.userData.noWeatherPaint22 = !0));
        const _e = [];
        (re.nodes.forEach((we, We) => {
          if (we.mesh !== void 0)
            for (const yt of re.meshes[we.mesh].primitives) {
              const Ft = new n.BufferGeometry();
              for (const [Rt, qt] of Object.entries(yt.attributes)) {
                const Kt = R(qt),
                  ro = {
                    POSITION: "position",
                    NORMAL: "normal",
                    TEXCOORD_0: "uv",
                    JOINTS_0: "skinIndex",
                    WEIGHTS_0: "skinWeight",
                  };
                ro[Rt] && Ft.setAttribute(ro[Rt], new n.BufferAttribute(Kt.array, Kt.size, Kt.normalized));
              }
              (Ft.setIndex(new n.BufferAttribute(R(yt.indices).array, 1)), Ft.computeBoundingSphere());
              const Bt = we.skin === void 0 ? new n.Mesh(Ft, a[yt.material]) : new n.SkinnedMesh(Ft, a[yt.material]);
              ((Bt.name = re.meshes[we.mesh].name),
                we.skin !== void 0 && (Bt.material.skinning = !0),
                (Bt.castShadow = !1),
                (Bt.receiveShadow = !0),
                (Bt.frustumCulled = !1),
                X[We].add(Bt),
                _e.push({ m: Bt, skin: we.skin }));
            }
        }),
          O.updateMatrixWorld(!0));
        const pe = re.skins.map((we) => {
          const We = R(we.inverseBindMatrices).array,
            yt = we.joints.map((Ft, Bt) => new n.Matrix4().fromArray(We, Bt * 16));
          return new n.Skeleton(
            we.joints.map((Ft) => X[Ft]),
            yt,
          );
        });
        for (const { m: we, skin: We } of _e) We !== void 0 && we.bind(pe[We], new n.Matrix4());
        const q = Object.fromEntries(X.map((we) => [we.name, we])),
          v = q.Armature,
          k = (we, We = 0.9) => {
            const yt = new n.MeshStandardMaterial({
              color: new n.Color(we).convertSRGBToLinear(),
              roughness: We,
              metalness: 0,
            });
            return ((yt.userData.noWeatherPaint22 = !0), yt);
          },
          h = [],
          b = [],
          p = [],
          S = [],
          x = [],
          c = [];
        let P = "common",
          C = !1,
          Ne = "mild";
        const z = k("#652838"),
          ce = k("#632d3d"),
          V = k("#c4b9a0"),
          Me = k("#443326"),
          je = k("#c4c6bc"),
          lt = { normal: h, summer: b, rain: p, winter: S };
        function Ke(we, We, yt, Ft, Bt, Rt) {
          var Kt;
          const qt = new n.Mesh(we, We);
          return (
            qt.position.fromArray(yt),
            Ft && qt.scale.fromArray(Ft),
            Rt && qt.rotation.set(...Rt),
            (qt.receiveShadow = !0),
            v.add(qt),
            v.updateMatrixWorld(!0),
            Bt.attach(qt),
            (Kt = lt[P]) == null || Kt.push(qt),
            qt
          );
        }
        const ve = q.spine_03,
          qe = q.Head;
        (Ke(
          new n.SphereGeometry(1, 12, 7, 0, Math.PI * 2, 0, Math.PI * 0.57),
          Me,
          [0, 1.706, -0.015],
          [0.089, 0.112, 0.101],
          qe,
        ),
          (P = "normal"),
          Ke(new n.TorusGeometry(0.106, 0.043, 5, 14, Math.PI * 1.68), ce, [0, 1.468, -0.085], [1.3, 0.76, 0.78], ve, [
            Math.PI * 0.56,
            0,
            Math.PI * 0.16,
          ]),
          Ke(new n.SphereGeometry(1, 10, 6), z, [0, 1.411, -0.134], [0.153, 0.098, 0.051], ve),
          Ke(new n.BoxGeometry(0.224, 0.102, 0.013), ce, [0, 1.114, 0.148], null, q.spine_01, [0.03, 0, 0]));
        for (const we of [-0.045, 0.045]) {
          const We = Ke(new n.CylinderGeometry(0.003, 0.003, 0.11, 5), V, [we, 1.397, 0.128], null, ve, [
            0.08,
            0,
            we * 0.8,
          ]);
          c.push({ mesh: We, rest: We.quaternion.clone(), phase: we * 19, amount: 0.24 });
        }
        const Xe = k("#30383a");
        for (const we of ["l", "r"]) {
          const We = we === "l" ? 1 : -1;
          (Ke(new n.BoxGeometry(0.112, 0.023, 0.215), je, [We * 0.105, 0.005, 0.034], null, q["foot_" + we]),
            Ke(new n.SphereGeometry(1, 10, 6), Xe, [We * 0.105, 0.046, 0.029], [0.059, 0.053, 0.122], q["foot_" + we]));
        }
        P = "common";
        const _t = ["l", "r"].map((we, We) => {
            const yt = new n.Object3D();
            return (
              (yt.name = "SoleContact_" + we),
              yt.position.set((We ? -1 : 1) * 0.105, 0, 0.045),
              v.add(yt),
              v.updateMatrixWorld(!0),
              q["foot_" + we].attach(yt),
              yt
            );
          }),
          Mt = ["l", "r"].map((we) => {
            const We = new n.Object3D();
            return ((We.name = "Grip_" + we), We.position.set(0, 0.043, 0.012), q["hand_" + we].add(We), We);
          }),
          st = k("#466159"),
          $ = k("#293b45"),
          U = k("#4e4038"),
          He = k("#242d31"),
          Ce = k("#573346"),
          xe = k("#b9b099"),
          H = k("#f7f5e9"),
          W = k("#d8a783"),
          D = k("#cdb05b"),
          De = k("#3a4442"),
          ke = k("#485948"),
          rt = k("#474944"),
          $e = { time: { value: 0 }, strength: { value: 0 }, direction: { value: new n.Vector2(1, 0) } };
        function B(we, We) {
          ((we.skinning = !0),
            (we.onBeforeCompile = (yt) => {
              ((yt.uniforms.uAvatarClothTime23 = $e.time),
                (yt.uniforms.uAvatarClothWind23 = $e.strength),
                (yt.uniforms.uAvatarClothDirection23 = $e.direction),
                (yt.vertexShader =
                  `uniform float uAvatarClothTime23,uAvatarClothWind23;
uniform vec2 uAvatarClothDirection23;
` + yt.vertexShader),
                (yt.vertexShader = yt.vertexShader.replace(
                  "#include <begin_vertex>",
                  `#include <begin_vertex>
float clothHem23=1.-smoothstep(1.06,1.38,position.y);float clothWave23=sin(uAvatarClothTime23*7.7+position.x*23.+position.y*9.)*.65+sin(uAvatarClothTime23*11.3-position.z*19.)*.35;float clothFlutter23=clothHem23*uAvatarClothWind23*` +
                    We.toFixed(4) +
                    ";transformed.xz+=uAvatarClothDirection23*clothFlutter23*(.6+clothWave23);transformed.y+=clothFlutter23*.28*clothWave23;",
                )));
            }),
            (we.customProgramCacheKey = () => "avatar-cloth23-" + We),
            (we.needsUpdate = !0));
        }
        for (const [we, We] of [
          [H, 0.014],
          [D, 0.011],
          [st, 0.006],
          [z, 0.011],
          [ce, 0.008],
        ])
          B(we, We);
        for (const we of a) we.name.includes("Sweat") && B(we, 0.012);
        const F = _e.filter(({ m: we }) => we.geometry.attributes.skinIndex && we.name.includes("Retopology"));
        function g(we, We, yt, Ft = S, Bt = "Vetement_saisonnier") {
          var uo;
          const Rt = (uo = F[0]) == null ? void 0 : uo.m.geometry;
          if (!Rt) return null;
          we.skinning = !0;
          const qt = Rt.clone(),
            Kt = qt.attributes.position.array,
            ro = [];
          for (const { m: Tt } of F) {
            const Jt = Tt.geometry.index.array,
              io = Tt.geometry.attributes.position.array;
            for (let po = 0; po < Jt.length; po += 3) {
              const Yo = Jt[po],
                ao = Jt[po + 1],
                wo = Jt[po + 2],
                zo = (io[Yo * 3] + io[ao * 3] + io[wo * 3]) / 3,
                Oo = (io[Yo * 3 + 1] + io[ao * 3 + 1] + io[wo * 3 + 1]) / 3,
                Q = (io[Yo * 3 + 2] + io[ao * 3 + 2] + io[wo * 3 + 2]) / 3;
              We(Tt.material.name, Oo, zo, Q) && ro.push(Yo, ao, wo);
            }
          }
          if (yt) for (let Tt = 0; Tt < Kt.length; Tt += 3) yt(Kt, Tt);
          (qt.setIndex(ro),
            (qt.attributes.position.needsUpdate = !0),
            qt.computeVertexNormals(),
            qt.computeBoundingSphere());
          const oo = new n.SkinnedMesh(qt, we);
          return (
            (oo.name = Bt),
            (oo.frustumCulled = !1),
            (oo.receiveShadow = !0),
            X[67].add(oo),
            oo.bind(pe[0], new n.Matrix4()),
            Ft.push(oo),
            oo
          );
        }
        const G = (we, We) => we.includes("Short") || (we.includes("Peau") && We < 0.635 && We > 0.105),
          Qe = (we, We) => {
            if (we[We + 1] < 1.03) {
              const yt = (we[We] < 0 ? -1 : 1) * 0.107;
              ((we[We] = yt + (we[We] - yt) * 1.12), (we[We + 2] *= 1.15));
            }
          },
          Fe = (we, We) => {
            ((we[We] *= 1.045), (we[We + 2] *= 1.12), we[We + 1] < 1.12 && (we[We + 1] -= 0.038));
          };
        (g($, G, Qe, S, "Pantalon_hiver_long"),
          g(st, (we) => we.includes("Sweat"), Fe, S, "Veste_hiver_rembourree"),
          g(De, G, Qe, p, "Pantalon_pluie"),
          g(D, (we) => we.includes("Sweat"), Fe, p, "Veste_impermeable_ocre"),
          g(
            H,
            (we, We, yt) => we.includes("Sweat") && Math.abs(yt) < 0.405,
            (we, We) => {
              we[We + 2] *= 1.025;
            },
            b,
            "Tshirt_blanc_manches_courtes",
          ),
          g(W, (we, We, yt) => we.includes("Sweat") && Math.abs(yt) >= 0.405, null, b, "Avant_bras_ete"));
        const Le = [],
          pt = [];
        for (const { m: we } of _e)
          ((we.material.name.includes("Sweat") || we.material.name.includes("Baskets")) && h.push(we),
            we.material.name.includes("Short") && Le.push(we),
            we.name === "Hair_SimpleParted" && pt.push(we));
        for (const { m: we } of F)
          if (we.material.name.includes("Peau")) {
            const We = we.geometry,
              yt = We.clone(),
              Ft = We.index.array,
              Bt = We.attributes.position.array,
              Rt = [];
            for (let qt = 0; qt < Ft.length; qt += 3) {
              const Kt = Ft[qt],
                ro = Ft[qt + 1],
                oo = Ft[qt + 2];
              (Bt[Kt * 3 + 1] + Bt[ro * 3 + 1] + Bt[oo * 3 + 1]) / 3 >= 0.635 && Rt.push(Kt, ro, oo);
            }
            (yt.setIndex(Rt), x.push({ mesh: we, normal: We, winter: yt }));
          }
        P = "summer";
        for (const we of ["l", "r"]) {
          const We = we === "l" ? 1 : -1,
            yt = q["foot_" + we];
          (Ke(new n.BoxGeometry(0.119, 0.015, 0.245), rt, [We * 0.105, 0.003, 0.041], null, yt),
            Ke(new n.SphereGeometry(1, 10, 6), W, [We * 0.105, 0.051, 0.034], [0.055, 0.054, 0.121], yt));
          for (const Ft of [-1, 1])
            Ke(new n.BoxGeometry(0.069, 0.017, 0.017), rt, [We * 0.105 + Ft * 0.024, 0.088, 0.077], null, yt, [
              -0.22,
              Ft * 0.55,
              Ft * 0.12,
            ]);
          Ke(new n.BoxGeometry(0.012, 0.027, 0.013), rt, [We * 0.105, 0.072, 0.104], null, yt);
        }
        ((P = "winter"),
          Ke(
            new n.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.56),
            Ce,
            [0, 1.737, -0.022],
            [0.124, 0.135, 0.132],
            qe,
          ),
          Ke(new n.TorusGeometry(0.112, 0.015, 5, 16), Ce, [0, 1.718, -0.022], [1, 1.1, 1], qe, [Math.PI / 2, 0, 0]),
          Ke(new n.TorusGeometry(0.102, 0.026, 5, 14), xe, [0, 1.544, 0.002], [1, 1.12, 1], q.neck_01, [
            Math.PI / 2,
            0,
            0,
          ]));
        const Ge = Ke(new n.BoxGeometry(0.058, 0.218, 0.019), xe, [-0.027, 1.42, 0.161], null, ve, [0.03, 0, -0.08]);
        (c.push({ mesh: Ge, rest: Ge.quaternion.clone(), phase: 2.4, amount: 0.16 }),
          Ke(new n.BoxGeometry(0.009, 0.303, 0.01), V, [0, 1.262, 0.165], null, q.spine_02));
        for (const we of ["winter", "rain"]) {
          P = we;
          for (const We of ["l", "r"]) {
            const yt = We === "l" ? 1 : -1,
              Ft = we === "rain" ? ke : U;
            (Ke(new n.BoxGeometry(0.146, 0.032, 0.251), He, [yt * 0.105, 0.008, 0.045], null, q["foot_" + We]),
              Ke(
                new n.SphereGeometry(1, 10, 6),
                Ft,
                [yt * 0.105, 0.059, 0.037],
                [0.075, 0.071, 0.142],
                q["foot_" + We],
              ),
              Ke(
                new n.CylinderGeometry(0.078, 0.067, we === "rain" ? 0.3 : 0.211, 9),
                Ft,
                [yt * 0.105, we === "rain" ? 0.217 : 0.179, -0.007],
                null,
                q["calf_" + We],
              ));
          }
        }
        ((P = "rain"),
          Ke(new n.TorusGeometry(0.106, 0.039, 5, 14, Math.PI * 1.68), D, [0, 1.47, -0.094], [1.34, 0.79, 0.87], ve, [
            Math.PI * 0.56,
            0,
            Math.PI * 0.16,
          ]),
          Ke(new n.BoxGeometry(0.01, 0.36, 0.012), He, [0, 1.272, 0.158], null, q.spine_02),
          (P = "common"));
        const m = new Set(),
          at = new Map();
        (te.traverse((we) => {
          we.isSkinnedMesh && m.add(we.material);
        }),
          te.traverse((we) => {
            if (!we.isMesh || we.isSkinnedMesh || !m.has(we.material)) return;
            const We = we.material;
            let yt = at.get(We);
            if (!yt) {
              ((yt = We.clone()), (yt.skinning = !1), (yt.onBeforeCompile = We.onBeforeCompile));
              const Ft = We.customProgramCacheKey.bind(We);
              ((yt.customProgramCacheKey = () => Ft() + "-avatar-rigid27"), at.set(We, yt));
            }
            we.material = yt;
          }));
        function ft(we) {
          if (!(we === Ne && ft.initialized)) {
            ((ft.initialized = !0), (Ne = we), (C = we === "winter"));
            for (const [We, yt] of Object.entries(lt))
              for (const Ft of yt) Ft.visible = We === (we === "mild" ? "normal" : we);
            for (const We of Le) We.visible = we === "summer" || we === "mild";
            for (const We of pt) We.visible = we !== "winter";
            for (const We of x) We.mesh.geometry = we === "winter" || we === "rain" ? We.winter : We.normal;
          }
        }
        ft("summer");
        const ue = new n.AnimationMixer(O),
          se = {},
          Ve = {};
        for (const we of re.animations) {
          const We = [];
          for (const Bt of we.channels) {
            const Rt = we.samplers[Bt.sampler],
              qt = R(Rt.input).array,
              Kt = R(Rt.output).array,
              ro = X[Bt.target.node].name,
              oo = Bt.target.path === "rotation" ? "quaternion" : "position";
            We.push(
              oo === "quaternion"
                ? new n.QuaternionKeyframeTrack(ro + ".quaternion", qt, Kt)
                : new n.VectorKeyframeTrack(ro + ".position", qt, Kt),
            );
          }
          const yt = new n.AnimationClip(we.name, -1, We),
            Ft = ue.clipAction(yt);
          (Ft.play(), Ft.setEffectiveWeight(0), (se[we.name] = Ft), (Ve[we.name] = 0));
        }
        const vt = pe[0].bones.map((we) => ({
          bone: we,
          p: we.position.clone(),
          q: we.quaternion.clone(),
          s: we.scale.clone(),
        }));
        function me() {
          for (const we of vt) (we.bone.position.copy(we.p), we.bone.quaternion.copy(we.q), we.bone.scale.copy(we.s));
        }
        function Re() {
          for (const we of vt) (we.p.copy(we.bone.position), we.q.copy(we.bone.quaternion), we.s.copy(we.bone.scale));
        }
        const et = new n.Vector3(),
          kt = new n.Vector3(),
          M = new n.Vector3(),
          ee = new n.Quaternion(),
          ge = new n.Quaternion(),
          ae = new n.Quaternion(),
          de = new n.Matrix4(),
          oe = [
            { active: !1, anchor: new n.Vector3() },
            { active: !1, anchor: new n.Vector3() },
          ],
          y = new n.Vector3(),
          I = new n.Vector3(),
          Be = new n.Vector3(),
          Se = new n.Vector3(),
          N = new n.Vector3();
        let Ie = !0,
          E = !1,
          Y = 0,
          w = "idle",
          be = 0,
          ne = 0.08,
          K = 0,
          fe = 1.38,
          Ee = !1,
          bt = 0,
          mt = null;
        function Ct(we, We, yt, Ft = 7) {
          te.updateMatrixWorld(!0);
          const Bt = te.localToWorld(yt.clone());
          for (let Rt = 0; Rt < Ft; Rt++)
            for (let qt = we.length - 1; qt >= 0; qt--) {
              const Kt = we[qt];
              (Kt.getWorldPosition(et),
                We.getWorldPosition(kt),
                kt.sub(et).normalize(),
                M.copy(Bt).sub(et).normalize(),
                ee.setFromUnitVectors(kt, M),
                Kt.getWorldQuaternion(ge),
                Kt.parent.getWorldQuaternion(ae).invert(),
                Kt.quaternion.copy(ae.multiply(ee.multiply(ge))).normalize(),
                Kt.updateMatrixWorld(!0));
            }
        }
        function Pt(we, We = {}) {
          we = Math.min(0.06, Math.max(0, we));
          const yt = Math.abs(We.speed || 0),
            Ft = We.grounded !== !1,
            Bt = !!We.riding,
            Rt = We.weather || {},
            qt = String(Rt.mode || Rt.type || Rt.kind || We.weather || "sun").toLowerCase(),
            Kt = Number(We.snow ?? Rt.snow) || 0,
            ro = Number(We.rain ?? Rt.rain) || 0;
          (ft(
            Kt > 0.22 || /snow|neige|winter/.test(qt)
              ? "winter"
              : ro > 0.2 || /rain|pluie/.test(qt)
                ? "rain"
                : /sun|soleil|clear/.test(qt)
                  ? "summer"
                  : "mild",
          ),
            ($e.time.value += we),
            ($e.strength.value +=
              (n.MathUtils.clamp(Number(We.wind) || 0, 0, 1.8) - $e.strength.value) * (1 - Math.exp(-we * 5))));
          const oo = We.windDirection || { x: 1, y: 0 },
            uo = Number(We.facing) || 0,
            Tt = Number(oo.x ?? oo[0]) || 0,
            Jt = Number(oo.y ?? oo.z ?? oo[1]) || 0;
          $e.direction.value
            .set(Math.cos(uo) * Tt - Math.sin(uo) * Jt, Math.sin(uo) * Tt + Math.cos(uo) * Jt)
            .normalize();
          for (const Q of c)
            (Q.mesh.quaternion.copy(Q.rest),
              Q.mesh.visible &&
                (Q.mesh.rotateX(Math.sin($e.time.value * 6.7 + Q.phase) * $e.strength.value * Q.amount),
                Q.mesh.rotateZ(Math.sin($e.time.value * 5.1 + Q.phase) * $e.strength.value * Q.amount * 0.6)));
          (me(), O.position.set(0, 0, 0), te.updateMatrixWorld(!0), te.getWorldPosition(y));
          const io = Ee && y.distanceTo(I) > 1.1;
          if ((I.copy(y), (Ee = !0), io || Bt !== E || !Ft)) for (const Q of oe) Q.active = !1;
          (!Ft && Ie && se.Jump_Start.reset(),
            Ft && !Ie && ((Y = 0.17), se.Jump_Land.reset()),
            (Ie = Ft),
            (E = Bt),
            (Y = Math.max(0, Y - we)),
            (bt += we));
          const po = Ft && !Bt && yt > 0.08,
            Yo = po ? Math.min(0.8, Math.abs(Number.isFinite(We.distance) ? We.distance : yt * we)) : 0,
            ao = n.MathUtils.smoothstep(yt, 2.2, 4.7);
          ((K += (ao - K) * (1 - Math.exp(-we * 9))), (fe = 1.38 + (3.15 - 1.38) * K), po && (ne += Yo / fe));
          const wo = ne - Math.floor(ne),
            zo = {};
          for (const Q in se) zo[Q] = 0;
          if (Bt) ((zo.Driving_Loop = 1), (w = "driving"));
          else if (!Ft) ((zo[We.verticalSpeed > 2.4 ? "Jump_Start" : "Jump_Loop"] = 1), (w = "jump"));
          else if (Y > 0 && yt < 0.6) ((zo.Jump_Land = 0.7), (zo.Idle_Loop = 0.3), (w = "land"));
          else if (yt < 0.08) ((zo.Idle_Loop = 1), (w = "idle"));
          else {
            const Q = 0.18 * Math.sin(K * Math.PI);
            ((zo.Walk_Loop = (1 - K) * (1 - Q)),
              (zo.Jog_Fwd_Loop = Q),
              (zo.Sprint_Loop = K * (1 - Q)),
              (w = K > 0.5 ? "run" : "walk"));
          }
          let Oo = 0;
          for (const Q in Ve) ((Ve[Q] += (zo[Q] - Ve[Q]) * (1 - Math.exp(-we * (Bt ? 16 : 12)))), (Oo += Ve[Q]));
          Oo < 0.001 && ((Ve.Idle_Loop = 1), (Oo = 1));
          for (const [Q, Oe] of Object.entries(se))
            (Oe.setEffectiveWeight(Ve[Q] / Oo),
              Q === "Walk_Loop" || Q === "Jog_Fwd_Loop" || Q === "Sprint_Loop"
                ? ((Oe.time = wo * Oe.getClip().duration), Oe.setEffectiveTimeScale(0))
                : Oe.setEffectiveTimeScale(1));
          if ((ue.update(we), Re(), te.updateMatrixWorld(!0), (mt = null), Bt)) {
            const Q = We.quadScale || 1,
              Oe = Dt,
              ut = n.MathUtils.clamp(We.steering || 0, -0.6, 0.6);
            O.position.z = 0.0409 + Math.max(0, Q - 1) * 0.2;
            const At = We.carDriving ? 0.08 : 0.8 + Math.abs(ut) * 0.3 + Math.max(0, Q - 1) * 0.5;
            (q.spine_01.rotateX(Math.min(1.05, At)),
              q.spine_01.rotateY(ut * 0.85),
              q.neck_01.rotateX(-0.28 - (At - 0.8) * 0.4),
              q.neck_01.rotateY(-ut * 0.25),
              te.updateMatrixWorld(!0));
            for (let It = 0; It < 2; It++) {
              const Vt = It ? "r" : "l",
                Ut = It ? -1 : 1,
                eo = Ut * (We.carDriving ? 0.16 : 0.36),
                mo = We.carDriving ? 1.02 : 1.153,
                vo = We.carDriving ? 0.56 : 0.424,
                fo = Math.cos(ut),
                Do = Math.sin(ut),
                ho = new n.Vector3(
                  eo * fo * Q,
                  (mo - (We.carDriving ? 0.63 : 0.94)) * Q + Oe,
                  (vo - eo * Do + (We.carDriving ? 0.17 : 0.12)) * Q,
                );
              (Ct([q["upperarm_" + Vt], q["lowerarm_" + Vt]], Mt[It], ho, 10),
                Ct(
                  [q["thigh_" + Vt], q["calf_" + Vt]],
                  _t[It],
                  new n.Vector3(
                    Ut * (We.carDriving ? 0.14 : 0.39) * Q,
                    Oe - (We.carDriving ? 0.5 : 0.53) * Q,
                    (We.carDriving ? 0.55 : 0.27) * Q,
                  ),
                  7,
                ));
            }
            be = 0;
          } else if (Ft) {
            const Q = 1 - Ve.Idle_Loop;
            (q.spine_02.rotateZ(Math.sin(wo * Math.PI * 2) * 0.013 * Q),
              q.neck_01.rotateZ(-Math.sin(wo * Math.PI * 2) * 0.008 * Q),
              te.updateMatrixWorld(!0),
              de.copy(te.matrixWorld).invert());
            let Oe = 1 / 0;
            for (const It of _t) (It.getWorldPosition(et).applyMatrix4(de), (Oe = Math.min(Oe, et.y)));
            const ut = K > 0.45 ? -0.016 : -Oe,
              At = n.MathUtils.clamp(ut, -0.055, 0.065);
            ((be += (At - be) * (1 - Math.exp(-20 * we))),
              (O.position.y = be),
              te.updateMatrixWorld(!0),
              de.copy(te.matrixWorld).invert());
            for (let It = 0; It < 2; It++) {
              const Vt = oe[It],
                Ut = It ? "r" : "l",
                eo = (wo + (It ? 0.5 : 0)) % 1;
              if (
                (_t[It].getWorldPosition(N).applyMatrix4(de),
                !(po && Q > 0.45 && (K > 0.45 ? eo > 0.07 && eo < 0.23 : eo > 0.07 && eo < 0.47)))
              ) {
                Vt.active = !1;
                continue;
              }
              ((mt = Ut),
                Vt.active || (Se.copy(N), (Se.y = 0), Vt.anchor.copy(te.localToWorld(Se)), (Vt.active = !0)),
                Se.copy(Vt.anchor).applyMatrix4(de),
                (Se.y = 0));
              const vo = Se.x - N.x,
                fo = Se.z - N.z,
                Do = Math.hypot(vo, fo),
                ho = K > 0.45 ? 0.14 : 0.11;
              (Do > ho &&
                ((Se.x = N.x + (vo * ho) / Do),
                (Se.z = N.z + (fo * ho) / Do),
                Vt.anchor.copy(te.localToWorld(Be.copy(Se)))),
                (Se.y = Math.max(N.y - 0.085, Math.min(N.y + 0.045, Se.y))),
                Ct([q["thigh_" + Ut], q["calf_" + Ut]], _t[It], Se, 3));
            }
          } else ((be *= Math.exp(-we * 10)), (O.position.y = be));
          te.updateMatrixWorld(!0);
        }
        function jt(we, We, yt) {
          const Ft = Math.sin(Math.min(1, we / 0.58) * Math.PI),
            Bt = 0.12 + 0.45 * Math.max(0, Ft);
          (q.spine_01.rotateX(Bt), q.spine_02.rotateX(0.08), q.neck_01.rotateX(-0.11), te.updateMatrixWorld(!0));
          const Rt = [te.worldToLocal(We.clone()), te.worldToLocal(yt.clone())];
          for (let qt = 0; qt < 2; qt++) {
            const Kt = qt ? "r" : "l";
            Ct([q["upperarm_" + Kt], q["lowerarm_" + Kt]], Mt[qt], Rt[qt], 10);
          }
          te.updateMatrixWorld(!0);
        }
        const Dt = 0.9491000175 * T;
        return (
          Pt(1 / 30, { speed: 0, grounded: !0 }),
          {
            group: te,
            update: Pt,
            poseDig24: jt,
            hipHeight: Dt,
            height: 1.75,
            source: A.source,
            skeleton: pe[0],
            bones: q,
            actions: se,
            getState: () => ({
              animation: w,
              weights: { ...Ve },
              contact: be,
              winter: C,
              outfit: Ne,
              clothWind: $e.strength.value,
              stepPhase: (ne - 0.08) * Math.PI * 2,
              gaitPhase: ne % 1,
              stride: fe,
              plantedFoot: mt,
            }),
            getMetrics: () => {
              let we = 0,
                We = 0;
              return (
                te.traverse((yt) => {
                  var Ft;
                  if (yt.isMesh) {
                    let Bt = yt.visible;
                    for (let Rt = yt.parent; Rt && Rt !== te; Rt = Rt.parent) Bt = Bt && Rt.visible;
                    if (!Bt) return;
                    (We++,
                      (we +=
                        (((Ft = yt.geometry.index) == null ? void 0 : Ft.count) ||
                          yt.geometry.attributes.position.count) / 3));
                  }
                }),
                { triangles: we, drawCalls: We, assetBytes: A.bytes, bones: pe[0].bones.length, clips: Object.keys(se) }
              );
            },
            dispose() {
              ue.stopAllAction();
            },
          }
        );
      }));
  })(),
  (globalThis.MoulinTreeGeometry20 = function (t, n, A, re = !1) {
    const R = [[], [], []],
      he = new t.Vector3(0, 1, 0),
      te = (A % 4) * 31 + ({ oak: 17, pine: 71, birch: 39, old: 101 }[n] || 17),
      O = (q) => {
        const v = Math.sin(q * 127.1 + te * 13.713) * 43758.5453;
        return v - Math.floor(v);
      };
    function T(q, v, k = 1, shade32 = null) {
      const h = v.index ? v.toNonIndexed() : v.clone(),
        b = h.attributes.position,
        n32 = h.attributes.normal,
        p = new Float32Array(b.count * 3);
      for (let S = 0; S < b.count; S++) {
        const x = Math.floor(S / 3),
          c =
            k *
            (0.91 + O(x + R[q].length * 73) * 0.13) *
            (shade32 ? shade32(b.getX(S), b.getY(S), b.getZ(S), n32 ? n32.getY(S) : 0) : 1);
        ((p[S * 3] = c), (p[S * 3 + 1] = c), (p[S * 3 + 2] = c));
      }
      (h.setAttribute("color", new t.BufferAttribute(p, 3)), R[q].push(h));
    }
    // V32 : couronnes plus douces. Les normales des facettes sont melangees a celles
    // de l'ellipsoide de chaque bouquet (eclairage arrondi, sans aspect de pierre taillee)
    // et chaque bouquet s'assombrit vers le bas et vers le coeur de l'arbre.
    function soften32(geometry, centre, radii, amount = 0.72) {
      const position = geometry.attributes.position,
        normal = geometry.attributes.normal;
      for (let i = 0; i < position.count; i++) {
        let rx = (position.getX(i) - centre[0]) / (radii[0] * radii[0]),
          ry = (position.getY(i) - centre[1]) / (radii[1] * radii[1]),
          rz = (position.getZ(i) - centre[2]) / (radii[2] * radii[2]);
        const rl = Math.hypot(rx, ry, rz) || 1;
        let nx = normal.getX(i) * (1 - amount) + (rx / rl) * amount,
          ny = normal.getY(i) * (1 - amount) + (ry / rl) * amount,
          nz = normal.getZ(i) * (1 - amount) + (rz / rl) * amount;
        const nl = Math.hypot(nx, ny, nz) || 1;
        normal.setXYZ(i, nx / nl, ny / nl, nz / nl);
      }
      normal.needsUpdate = !0;
    }
    function blobShade32(centre, radii) {
      const outer = Math.hypot(centre[0], centre[2]) + radii[0];
      return (x, y, z) => {
        const local = t.MathUtils.clamp((y - centre[1]) / radii[1], -1, 1),
          lift = t.MathUtils.smoothstep(local, -1, 0.85),
          rim = t.MathUtils.clamp(Math.hypot(x, z) / Math.max(0.001, outer), 0, 1);
        return (0.7 + 0.36 * lift) * (0.9 + 0.13 * rim);
      };
    }
    function le(q, v, k, h, b, p = 5, S = 1) {
      const x = new t.Vector3(...v),
        c = new t.Vector3(...k),
        P = new t.CylinderGeometry(b, h, x.distanceTo(c), p, 1, !0);
      (P.applyMatrix4(
        new t.Matrix4().makeRotationFromQuaternion(
          new t.Quaternion().setFromUnitVectors(he, c.clone().sub(x).normalize()),
        ),
      ),
        P.translate(...x.add(c).multiplyScalar(0.5).toArray()),
        T(q, P, S),
        P.dispose());
    }
    function X(q, v, k, h = 1, b = re ? 1 : 0) {
      const p = re && b > 0 ? 3 : 1;
      for (let S = 0; S < p; S++) {
        const x = k * 0.71 + S * 2.39996,
          c = p > 1 ? 0.37 : 0,
          P = p > 1 ? 0.69 : 1,
          C = [
            q[0] + Math.cos(x) * v[0] * c,
            q[1] + Math.sin(x * 1.33) * v[1] * c * 0.55,
            q[2] + Math.sin(x) * v[2] * c,
          ],
          Ne = new t.IcosahedronGeometry(1, b),
          z = Ne.attributes.position,
          ce = k * 0.713 + A * 0.41 + S * 0.37,
          V = Math.cos(ce),
          Me = Math.sin(ce);
        for (let je = 0; je < z.count; je++) {
          const lt = z.getX(je),
            Ke = z.getY(je),
            ve = z.getZ(je),
            qe = O(Math.round(lt * 103 + Ke * 79 + ve * 137) + k * 31 + S * 43),
            Xe = 0.91 + qe * 0.17;
          z.setXYZ(
            je,
            (lt * V - ve * Me) * v[0] * Xe * P + C[0],
            Ke * v[1] * Xe * P + C[1],
            (lt * Me + ve * V) * v[2] * Xe * P + C[2],
          );
        }
        (Ne.computeVertexNormals(),
          soften32(Ne, C, [v[0] * P, v[1] * P, v[2] * P]),
          T(2, Ne, h * (0.97 + O(k + S * 17) * 0.06), blobShade32(C, [v[0] * P, v[1] * P, v[2] * P])),
          Ne.dispose());
      }
    }
    function a(q, v) {
      const h = [];
      for (let p = 0; p < q.length - 1; p++)
        for (let S = 0; S < 8; S++) {
          const x = (S * Math.PI * 2) / 8,
            c = ((S + 1) * Math.PI * 2) / 8,
            P = (V, Me, je) => {
              const lt = V === 0 ? (je % 2 === 0 ? 1.16 : 0.9) : 1;
              return [q[V][0] + Math.cos(Me) * v[V] * lt, q[V][1], q[V][2] + Math.sin(Me) * v[V] * lt];
            },
            C = P(p, x, S),
            Ne = P(p, c, S + 1),
            z = P(p + 1, c, S + 1),
            ce = P(p + 1, x, S);
          h.push(...C, ...ce, ...Ne, ...Ne, ...ce, ...z);
        }
      const b = new t.BufferGeometry();
      (b.setAttribute("position", new t.Float32BufferAttribute(h, 3)), b.computeVertexNormals(), T(0, b), b.dispose());
    }
    function _e() {
      for (let q = 0; q < 5; q++) {
        const v = q * 2.39996 + A * 0.6,
          k = 0.06 + O(q + 6) * 0.017,
          h = 0.011,
          b = (ce, V, Me) => [Math.cos(v) * ce - Math.sin(v) * Me, V, Math.sin(v) * ce + Math.cos(v) * Me],
          p = b(0.022, -0.006, -h),
          S = b(0.022, -0.006, h),
          x = b(0.023, 0.073, -h * 0.43),
          c = b(0.023, 0.073, h * 0.43),
          P = b(k, -0.006, h * 0.26),
          C = b(k, -0.006, -h * 0.26),
          Ne = [];
        for (const ce of [
          [p, S, c],
          [p, c, x],
          [x, c, P],
          [x, P, C],
          [p, x, C],
          [S, P, c],
          [p, C, P],
          [p, P, S],
        ])
          Ne.push(...ce[0], ...ce[1], ...ce[2]);
        const z = new t.BufferGeometry();
        (z.setAttribute("position", new t.Float32BufferAttribute(Ne, 3)),
          z.computeVertexNormals(),
          T(0, z, 0.95),
          z.dispose());
      }
    }
    const pe = A % 4;
    if (n === "pine") {
      (a(
        [
          [0, 0, 0],
          [0.006, 0.29, -0.004],
          [-0.006, 0.64, 0.009],
          [0.005, 0.98, 0],
        ],
        [0.035, 0.022, 0.012, 0.0025],
      ),
        _e());
      const q = pe % 2 ? 6 : 7;
      for (let v = 0; v < q; v++) {
        const k = 0.29 + v * (0.57 / (q - 1)),
          h = (pe % 2 ? 0.235 : 0.27) * (1 - v / (q + 1)),
          b = k + 0.072,
          p = v * 2.39996 + pe * 0.6;
        for (let Ne = 0; Ne < 3; Ne++) {
          const z = p + Ne * 2.094,
            ce = h * (0.7 + O(v * 17 + Ne) * 0.16);
          le(
            1,
            [0, k - 0.035, 0],
            [Math.cos(z) * ce, k + 0.012, Math.sin(z) * ce],
            0.006 * (1 - (v / q) * 0.65),
            0.0015,
            5,
            0.82,
          );
        }
        const S = [],
          x = 10,
          c = Math.sin(p) * h * 0.1,
          P = Math.cos(p) * h * 0.1;
        for (let Ne = 0; Ne < x; Ne++) {
          const z = (Ne * Math.PI * 2) / x + p,
            ce = ((Ne + 1) * Math.PI * 2) / x + p,
            V = h * (0.84 + O(v * 41 + Ne) * 0.23),
            Me = h * (0.84 + O(v * 41 + Ne + 1) * 0.23),
            je = k + (Ne % 2) * 0.025,
            lt = k + ((Ne + 1) % 2) * 0.025,
            Ke = [c, b + 0.14, P],
            ve = [Math.cos(z) * V, je, Math.sin(z) * V],
            qe = [Math.cos(ce) * Me, lt, Math.sin(ce) * Me],
            Xe = [c, b - 0.055, P];
          S.push(...Ke, ...qe, ...ve, ...Xe, ...ve, ...qe);
        }
        const C = new t.BufferGeometry();
        (C.setAttribute("position", new t.Float32BufferAttribute(S, 3)),
          C.computeVertexNormals(),
          T(2, C, 0.83 + v * 0.026, (x, y, z, ny) => 0.72 + 0.3 * t.MathUtils.smoothstep(ny, -0.6, 0.75)),
          C.dispose());
      }
      X([0.004, 0.956, 0], [0.055, 0.085, 0.057], 91, 1.03, 0);
    } else if (n === "birch") {
      (a(
        [
          [0, 0, 0],
          [-0.005, 0.18, 0.001],
          [0.008, 0.45, 0.006],
          [-0.014, 0.7, 0.011],
          [0.012, 0.955, 0.018],
        ],
        [0.028, 0.023, 0.015, 0.008, 0.0028],
      ),
        _e());
      for (let q = 0; q < 7; q++) {
        const v = q * 2.39996 + A * 0.7,
          k = 0.32 + q * 0.071,
          h = (0.1 + Math.sin((q / 7) * Math.PI) * 0.064) * (pe % 2 ? 0.91 : 1.08),
          b = [Math.cos(v) * h, k + 0.145, Math.sin(v) * h];
        (le(
          1,
          [q % 2 ? 0.005 : -0.005, k, 0],
          [b[0] * 0.68, b[1] - 0.05, b[2] * 0.68],
          0.0075 - q * 7e-4,
          0.004,
          5,
          0.94,
        ),
          le(1, [b[0] * 0.68, b[1] - 0.05, b[2] * 0.68], b, 0.004, 0.0015, 4, 0.91),
          X(b, [0.108, 0.128, 0.094], q, 0.92 + (q % 3) * 0.04, q % 3 === 0 ? 1 : 0));
      }
      X([0.014, 0.902, 0.018], [0.115, 0.13, 0.1], 44, 1.02, 1);
      for (let q = 0; q < 12; q++) {
        const v = O(q + 200) * 6.283,
          k = 0.07 + q * 0.052;
        le(
          0,
          [Math.cos(v) * 0.024, k, Math.sin(v) * 0.024],
          [Math.cos(v + 0.55) * 0.024, k + 0.005, Math.sin(v + 0.55) * 0.024],
          0.0028,
          0.0028,
          4,
          0.23,
        );
      }
    } else {
      const q = n === "old",
        v = !q && pe === 1,
        k = q || pe === 2,
        h = (pe - 1.5) * 0.006,
        b = k ? 1.13 : v ? 0.79 : 1,
        p = v ? 1.11 : k ? 0.88 : 1;
      (a(
        [
          [0, 0, 0],
          [h * 0.45, 0.08, -0.002],
          [h, 0.23, 0.007],
          [-h, 0.43, 0.003],
          [h * 0.6, 0.61, -0.008],
          [h, 0.77, 0.012],
        ],
        [q ? 0.049 : 0.039, 0.033, 0.026, 0.018, 0.01, 0.0035],
      ),
        _e());
      const S = q ? 5 : 4;
      for (let x = 0; x < S; x++) {
        const c = x * 2.39996 + pe * 0.71 + (O(x + 8) - 0.5) * 0.55,
          P = 0.32 + O(x + 61) * 0.17,
          C = (0.15 + O(x + 10) * 0.1) * b,
          Ne = 0.56 + (x % 3) * 0.084 * p,
          z = [Math.cos(c) * C * 0.54, P + 0.12, Math.sin(c) * C * 0.52],
          ce = [Math.cos(c) * C, Ne, Math.sin(c) * C];
        (le(1, [h, P, 0], z, q ? 0.016 : 0.013, 0.009, 6, 1),
          le(1, z, ce, 0.009, 0.0035, 5, 0.93),
          X(
            [ce[0], ce[1] + 0.036, ce[2]],
            [0.133 * b, 0.134 * p, 0.129 * b],
            x,
            0.88 + (x % 3) * 0.047,
            re || (x === pe % S && pe !== 1) ? 1 : 0,
          ));
        const V = c + (x % 2 ? 0.66 : -0.79),
          Me = [ce[0] * 0.76 + Math.cos(V) * 0.076, ce[1] + 0.114 * p, ce[2] * 0.76 + Math.sin(V) * 0.072];
        (le(1, z, Me, 0.007, 0.0025, 5, 0.96), X(Me, [0.126 * b, 0.145 * p, 0.125 * b], x + 24, 0.96 + (x % 2) * 0.04));
      }
      X([h, 0.733, 0.005], [0.171 * b, 0.154 * p, 0.162 * b], 75, 0.97, 1);
      for (let x = 0; x < 3; x++) {
        const c = x * 2.35 + pe * 0.73,
          P = (x === 0 ? 0.071 : 0.112) * b;
        X(
          [Math.cos(c) * P, 0.827 + (x % 2) * 0.037 * p, Math.sin(c) * P],
          [0.118 * b, 0.132 * p, 0.119 * b],
          x + 82,
          1.025 + (x % 2) * 0.025,
          1,
        );
      }
      if (re)
        for (let x = 0; x < 6; x++) {
          const c = x * 2.39996 + pe,
            P = (0.17 + O(x + 71) * 0.07) * b;
          X(
            [Math.cos(c) * P, 0.57 + (x % 3) * 0.104, Math.sin(c) * P],
            [0.07, 0.08, 0.068],
            x + 140,
            0.92 + O(x + 6) * 0.14,
            0,
          );
        }
    }
    return R.map((q) => {
      const v = q.reduce((x, c) => x + c.attributes.position.count, 0),
        k = new Float32Array(v * 3),
        h = new Float32Array(v * 3),
        b = new Float32Array(v * 3);
      let p = 0;
      for (const x of q)
        (k.set(x.attributes.position.array, p),
          h.set(x.attributes.normal.array, p),
          b.set(x.attributes.color.array, p),
          (p += x.attributes.position.array.length),
          x.dispose());
      const S = new t.BufferGeometry();
      return (
        S.setAttribute("position", new t.BufferAttribute(k, 3)),
        S.setAttribute("normal", new t.BufferAttribute(h, 3)),
        S.setAttribute("color", new t.BufferAttribute(b, 3)),
        S.setIndex(Array.from({ length: v }, (x, c) => c)),
        S.computeBoundingBox(),
        S.computeBoundingSphere(),
        (S.userData.catalogue28 = { species: n, variant: pe, detailed: re }),
        S
      );
    });
  }),
  (globalThis.MoulinVegetation20 = function (t, n) {
    const A = [],
      re = new Set(),
      R = new Set(),
      he = new Set(n.props.catalog.map((b) => b.id)),
      te = (b, p, S) => {
        const x = b + "|" + p.toFixed(3) + "|" + S.toFixed(3);
        let c = 2166136261;
        for (let C = 0; C < x.length; C++) c = Math.imul(c ^ x.charCodeAt(C), 16777619);
        let P = 2e8 + (c >>> 0);
        for (; R.has(P); ) P++;
        return (R.add(P), "objet-" + P);
      },
      O = (b, p, S = 0) => {
        const x = Math.sin(b * 127.1 + p * 311.7 + S * 53.4) * 43758.5453;
        return x - Math.floor(x);
      },
      T = (b, p) => p && p.length > 2 && n.inside(b, p),
      le = (b, p) => (p && p.length > 1 ? n.edgeDistance(b, p, !1) : 1 / 0);
    function X(b, p, S = 0.4) {
      var P;
      const x = [b, p];
      return !!(
        !Number.isFinite(n.terrainHeight(b, p)) ||
        n.wetAt(x, 0.08) ||
        n.foundationFootprints.some((C) => n.footprintDistance(b, p, C) < S + 0.16) ||
        T(x, n.yard) ||
        T(x, n.patio) ||
        ((P = n.hillCorridorAt) != null && P.call(n, b, p, S + 0.15)) ||
        n.paths.some((C) => le(x, C) < (C === n.paths[0] ? 2.2 : 1.5) + S) ||
        n.propertyTrails.some((C) => {
          const Ne = n.trailSample(x, C, S + 1);
          return Ne && Ne.d < C.width * 0.5 + S;
        }) ||
        (n.hillSteps || []).some((C) => {
          const Ne = b - C.x,
            z = p - C.z;
          return (
            Math.abs(Ne * C.dx + z * C.dz) < C.length * 0.5 + S && Math.abs(Ne * C.dz - z * C.dx) < C.width * 0.5 + S
          );
        }) ||
        ((n.ground ? n.ground(b, p) : n.terrainHeight(b, p)) - n.terrainHeight(b, p) > 0.45 && !T(x, n.pointGarden))
      );
    }
    function a(b, p, S, x = 1, c = 0, P = 0, C = !1) {
      if (
        (n.scope === "hero" && (p < -40 || p > 24 || S < -20 || S > 38)) ||
        !he.has(b) ||
        (!C && X(p, S, Math.min(0.75, x * 0.25)))
      )
        return;
      const Ne = Math.round(p * 3) + ":" + Math.round(S * 3);
      re.has(Ne) ||
        (re.add(Ne),
        A.push({
          id: te(b, p, S),
          type: b,
          x: +p.toFixed(3),
          z: +S.toFixed(3),
          scale: +x.toFixed(3),
          rotation: +c.toFixed(4),
          variant: Math.floor(O(p, S, 3) * 4),
          yOffset: +P.toFixed(3),
        }));
    }
    for (const b of n.waterRegions) {
      let p = 0,
        S = 0;
      for (let x = 0; x < b.poly.length; x++) {
        const c = b.poly[x],
          P = b.poly[(x + 1) % b.poly.length],
          C = P[0] - c[0],
          Ne = P[1] - c[1],
          z = Math.hypot(C, Ne);
        if (z < 0.01) continue;
        let ce = -Ne / z,
          V = C / z;
        T([c[0] + ce * 0.5, c[1] + V * 0.5], b.poly) && ((ce = -ce), (V = -V));
        for (let Me = 0.7; Me < z; Me += 2.55) {
          const je = c[0] + (C * Me) / z,
            lt = c[1] + (Ne * Me) / z,
            Ke = Math.hypot(je, lt) > 118;
          if (Ke && O(je, lt, 27) > 0.12) continue;
          const ve = O(je, lt, 8);
          if (ve < 0.27) continue;
          const qe = 0.45 + ve * 0.95,
            Xe = je + ce * qe,
            _t = lt + V * qe;
          n.terrainHeight(Xe, _t) > b.level + 3.2 ||
            (a("touffes-herbe", Xe, _t, (Ke ? 1.05 : 0.9) + ve * 0.66, ve * 6.28),
            !Ke &&
              (ve > 0.35 &&
                a(
                  ve > 0.76 ? "fleurs-sauvages" : "fougere",
                  Xe + ce * 0.85 + V * 0.35,
                  _t + V * 0.85 - ce * 0.35,
                  0.65 + ve * 0.48,
                  ve * 5,
                ),
              ve > 0.88 && a("hortensia", Xe + ce * 1.6, _t + V * 1.6, 0.8 + ve * 0.35, ve * 4)));
        }
      }
    }
    for (const b of n.forest.records) {
      const p = Math.hypot(b.x, b.z),
        S = p > 76;
      if (S && O(b.x, b.z, 44) > 0.085) continue;
      const x = S ? 1 : p < 38 ? 5 : 2;
      for (let c = 0; c < x; c++) {
        const P = b.rotation + c * 2.39996,
          C = O(b.x, b.z, c),
          Ne = Math.max(0.75, b.diameter * 1.2) + C * 0.8,
          z = b.x + Math.cos(P) * Ne,
          ce = b.z + Math.sin(P) * Ne;
        a(
          S
            ? C > 0.72
              ? "fougere"
              : "touffes-herbe"
            : c % 3 === 0
              ? "fougere"
              : c % 3 === 1
                ? "touffes-herbe"
                : "fleurs-sauvages",
          z,
          ce,
          (p < 38 ? 1.08 : 0.85) + C * 0.53,
          P,
        );
      }
    }
    for (const [b, p, S] of [
      [-27, 11, 1.1],
      [-29, 12, 1.2],
      [-24, 11.2, 0.9],
      [-13.6, 2.2, 0.86],
      [-12.8, -0.6, 0.9],
      [-11.8, -4, 0.82],
      [-11.1, -6.8, 0.8],
      [10.8, 12, 1],
      [13.7, 11.4, 0.86],
      [15, 9.1, 0.88],
      [-19, 18.7, 1],
      [-22, 18.3, 0.95],
      [-14.5, 18.9, 0.8],
    ])
      (a("hortensia", b, p, S, O(b, p) * 6), a("fleurs-sauvages", b + 0.85, p + 0.6, 0.88, O(p, b) * 6));
    const _e = A.length;
    for (const [b, p, S] of [
      [-9.5, -14.1, 1.55],
      [-10.25, -11, 1.7],
      [-10.9, -8.15, 1.65],
      [-12.1, -5.3, 1.35],
      [-9.65, -18.8, 1.25],
      [-14.2, -12.7, 1.4],
    ])
      a("bosquet", b, p, S, O(b, p) * 6.28);
    for (const [b, p, S] of [
      [-8.4, -11.9, 0.86],
      [-9.45, -9.5, 0.96],
      [-10.55, -6.55, 0.9],
      [-12.15, -3.6, 0.86],
      [-10.2, -15, 0.78],
    ])
      a("hortensia", b, p, S, O(p, b) * 6.28);
    for (let b = 0; b < 28; b++) {
      const p = b / 27,
        S = -8.1 - p * 3 + Math.sin(b * 2.4) * 0.37,
        x = -15.6 + p * 11.2 + Math.cos(b * 1.7) * 0.3;
      Math.hypot(S + 6.9, x + 13.4) < 1.3 ||
        a(
          b % 4 === 0 ? "mousse-rocher" : b % 4 === 1 ? "fleurs-sauvages" : "fougere",
          S,
          x,
          0.75 + O(S, x) * 0.38,
          O(x, S) * 6.28,
        );
    }
    const pe = A.slice(_e),
      q = n.pointGarden || [];
    for (let b = 0; b < q.length; b++) {
      const p = q[b],
        S = q[(b + 1) % q.length],
        x = S[0] - p[0],
        c = S[1] - p[1],
        P = Math.hypot(x, c);
      if (P < 0.1) continue;
      let C = -c / P,
        Ne = x / P;
      T([(p[0] + S[0]) * 0.5 + C * 0.7, (p[1] + S[1]) * 0.5 + Ne * 0.7], q) || ((C = -C), (Ne = -Ne));
      for (let z = 0.6; z < P; z += 1.5) {
        const ce = p[0] + (x * z) / P + C * 0.7,
          V = p[1] + (c * z) / P + Ne * 0.7;
        (ce < 7 && V > 10) ||
          (a("touffes-herbe", ce, V, 1.22, O(ce, V) * 6),
          a("fleurs-sauvages", ce + C * 0.55, V + Ne * 0.55, 1.05, O(V, ce) * 6));
      }
    }
    const v = n.forest.records.find((b) => b.id === "arbre-1239");
    if (v)
      for (let b = 0; b < 14; b++) {
        const p = b * 2.39996,
          S = 1.6 + (b % 3) * 0.55,
          x = v.x + Math.sin(p) * S,
          c = v.z + Math.cos(p) * S;
        a(
          b % 4 === 0 ? "hortensia" : b % 4 === 1 ? "fleurs-sauvages" : b % 4 === 2 ? "fougere" : "touffes-herbe",
          x,
          c,
          b % 4 === 0 ? 0.88 : 1.25,
          p,
        );
      }
    const k = n.foundationFootprints.find((b) => b.name === "Moulin");
    if (k) {
      const b = Math.cos(k.angle),
        p = Math.sin(k.angle);
      for (const S of [-4.5, -3.8, -0.35, 0.55, 1.6, 3.45]) {
        const x = k.v1 + 0.13,
          c = k.cx + S * b + x * p,
          P = k.cz - S * p + x * b;
        n.wetAt([c, P], 0.03) || a("fleurs-sauvages", c, P, 0.65, k.angle, 0, !0);
      }
    }
    const h = [
      [-20, 14.5],
      [-11.5, 17.2],
      [-6.5, 17],
      [0.8, 16.6],
    ];
    for (let b = 0; b < h.length - 1; b++) {
      const p = h[b],
        S = h[b + 1],
        x = S[0] - p[0],
        c = S[1] - p[1],
        P = Math.hypot(x, c);
      if (P < 1 || Math.max(p[1], S[1]) < 11.5) continue;
      let C = -c / P,
        Ne = x / P;
      for (let z = 1.1; z < P - 0.6; z += 2.4) {
        const ce = p[0] + (x * z) / P + C * 0.3,
          V = p[1] + (c * z) / P + Ne * 0.3,
          Me = 1.18 - (n.ground ? n.ground(ce, V) : n.terrainHeight(ce, V));
        a("lierre-retombant", ce, V, 0.9 + O(ce, V) * 0.25, Math.atan2(C, Ne), Me, !0);
      }
    }
    return (
      A.sort((b, p) => Math.hypot(b.x, b.z) - Math.hypot(p.x, p.z)),
      A.length > 1190 && (A.length = 1190),
      {
        fountainObjects23: pe,
        defaultObjects: A,
        update() {},
        setQuality() {},
        stats: {
          editablePlantings: A.length,
          types: [...new Set(A.map((b) => b.type))],
          treeGeometry: "faceted-roots-branched-perforated-crowns",
        },
      }
    );
  }),
  (globalThis.MoulinWind20 = function (t, n) {
    var pe, q;
    const A = {
        time: { value: 0 },
        wind: { value: 0 },
        windDirection: { value: new t.Vector2(0.96, 0.28).normalize() },
        leafPorosity: { value: n.leafPorosity ?? 0.24 },
        sunSlope: { value: new t.Vector2(0.607, -0.321) },
      },
      re =
        n.sun ||
        ((q = (pe = n.model) == null ? void 0 : pe.parent) == null
          ? void 0
          : q.children.find((v) => v.isDirectionalLight && v.castShadow)),
      R = new WeakSet(),
      he = new Map(),
      te = { version: 25, materials: 0, meshes: 0, maxForce: 1.8 };
    let O = "";
    function T(v, k, h = !1) {
      ((v.uniforms.uMoulinTime20 = A.time),
        (v.uniforms.uMoulinWind20 = A.wind),
        (v.uniforms.uMoulinDirection20 = A.windDirection),
        (v.vertexShader =
          (k === "tree" || k === "wood"
            ? `attribute vec2 aTreeShape23;
`
            : "") +
          `uniform float uMoulinTime20;
uniform float uMoulinWind20;
uniform vec2 uMoulinDirection20;
` +
          v.vertexShader),
        h &&
          k === "tree" &&
          ((v.uniforms.uMoulinLeafPorosity20 = A.leafPorosity),
          (v.uniforms.uMoulinSunSlope20 = A.sunSlope),
          (v.vertexShader =
            `varying vec3 vMoulinLeafWorld20;
` + v.vertexShader),
          (v.fragmentShader =
            `varying vec3 vMoulinLeafWorld20;
uniform float uMoulinLeafPorosity20;
uniform vec2 uMoulinSunSlope20;
` + v.fragmentShader),
          (v.fragmentShader = v.fragmentShader.replace(
            "#include <clipping_planes_fragment>",
            `#include <clipping_planes_fragment>
   vec2 mlProjection20=(vMoulinLeafWorld20.xz+uMoulinSunSlope20*vMoulinLeafWorld20.y)*2.25;
   vec2 mlCell20=floor(mlProjection20),mlF20=fract(mlProjection20);mlF20=mlF20*mlF20*(3.0-2.0*mlF20);
   float mlA20=fract(sin(dot(mlCell20,vec2(127.1,311.7)))*43758.5453);
   float mlB20=fract(sin(dot(mlCell20+vec2(1.0,0.0),vec2(127.1,311.7)))*43758.5453);
   float mlC20=fract(sin(dot(mlCell20+vec2(0.0,1.0),vec2(127.1,311.7)))*43758.5453);
   float mlD20=fract(sin(dot(mlCell20+vec2(1.0,1.0),vec2(127.1,311.7)))*43758.5453);
   float mlOpening20=mix(mix(mlA20,mlB20,mlF20.x),mix(mlC20,mlD20,mlF20.x),mlF20.y);
   if(uMoulinLeafPorosity20>0.0&&mlOpening20<.24+uMoulinLeafPorosity20*.54)discard;
  `,
          ))));
      const b =
        k === "bamboo"
          ? "pow(clamp(position.y/6.4,0.,1.),2.)"
          : k === "tree" || k === "wood"
            ? "pow(clamp(aTreeShape23.x+position.y*aTreeShape23.y,0.0,1.0),2.0)"
            : k === "ivy"
              ? "clamp(abs(position.y)*1.45,0.0,1.0)"
              : "pow(clamp(position.y*1.65,0.0,1.0),1.15)";
      v.vertexShader = v.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
   float mwMask20=${b};
   vec3 mwX20=modelMatrix[0].xyz, mwY20=modelMatrix[1].xyz, mwZ20=modelMatrix[2].xyz;
   vec3 mwOrigin20=(modelMatrix*vec4(0.0,0.0,0.0,1.0)).xyz;
   #ifdef USE_INSTANCING
    mwX20=(modelMatrix*vec4(instanceMatrix[0].xyz,0.0)).xyz;
    mwY20=(modelMatrix*vec4(instanceMatrix[1].xyz,0.0)).xyz;
    mwZ20=(modelMatrix*vec4(instanceMatrix[2].xyz,0.0)).xyz;
    mwOrigin20=(modelMatrix*instanceMatrix*vec4(0.0,0.0,0.0,1.0)).xyz;
   #endif
   float mwPhase20=dot(mwOrigin20.xz,vec2(.113,.087))+position.x*.41+position.z*.33;
   float mwForce23=pow(clamp(uMoulinWind20,0.,1.8),1.05);
   vec2 mwDir20=normalize(uMoulinDirection20+vec2(.00001));
   vec2 mwCross32=vec2(-mwDir20.y,mwDir20.x);
   // V32 : rafales qui traversent la vallee dans le sens du vent ; chaque arbre a sa raideur.
   float mwAlong32=dot(mwOrigin20.xz,mwDir20);
   float mwTree32=fract(sin(dot(floor(mwOrigin20.xz*1.7),vec2(12.9898,78.233)))*43758.5453);
   float mwFront32=sin(mwAlong32*.042-uMoulinTime20*(.55+mwForce23*.45)+sin(mwAlong32*.011+uMoulinTime20*.07)*2.2);
   float mwGust23=smoothstep(-.2,1.,mwFront32)*(.6+.4*sin(uMoulinTime20*.23+mwTree32*6.28));
   ${k === "tree" || k === "wood" ? `// Amplitudes reelles : la cime d'un chene de 20 m bouge de 15 a 25 cm par vent leger,
   // d'environ 60 cm par vent fort ; frequence propre plus lente pour les grands arbres.
   float mwHeight32=max(1.,length(mwY20));
   float mwReach32=(.03+.32*mwForce23)*sqrt(mwHeight32*.1)*(.75+.5*mwTree32);
   float mwFreq32=6.2832*1.2/sqrt(mwHeight32)*(.9+.2*mwTree32);
   float mwLean32=mwReach32*(.45+.55*mwGust23);
   float mwSwing32=mwReach32*.35*sin(uMoulinTime20*mwFreq32+mwTree32*6.283-mwAlong32*.05);
   float mwSide32=mwReach32*.18*sin(uMoulinTime20*mwFreq32*1.31+mwTree32*11.)*(.5+.5*mwGust23);
   float mwAmount20=mwMask20*(mwLean32+mwSwing32);
   vec2 mwPush32=mwDir20*mwAmount20+mwCross32*mwMask20*mwSide32;
   float mwDrop32=dot(mwPush32,mwPush32)*.5/mwHeight32;` : k === "bamboo" ? `float mwReach32=.05+.42*mwForce23;
   float mwAmount20=mwMask20*mwReach32*(.5+.4*mwGust23+.3*sin(uMoulinTime20*(3.6+mwTree32)+mwPhase20));
   vec2 mwPush32=mwDir20*mwAmount20+mwCross32*mwMask20*mwReach32*.15*sin(uMoulinTime20*4.7+mwPhase20);
   float mwDrop32=dot(mwPush32,mwPush32)*.08;` : k === "ivy" ? `float mwAmount20=mwMask20*(.006+.03*mwForce23)*(.5+.5*mwGust23+.4*sin(uMoulinTime20*5.1+mwPhase20));
   vec2 mwPush32=mwDir20*mwAmount20;
   float mwDrop32=0.;` : `float mwReach32=.02+.14*mwForce23;
   float mwAmount20=mwMask20*mwReach32*(.55+.45*mwGust23+.35*sin(uMoulinTime20*(5.2+.8*mwTree32)+mwPhase20));
   vec2 mwPush32=mwDir20*mwAmount20+mwCross32*mwMask20*mwReach32*.2*sin(uMoulinTime20*6.3+mwPhase20*1.7);
   float mwDrop32=dot(mwPush32,mwPush32)*.3;`}
   transformed.x+=dot(mwPush32,mwX20.xz/max(.001,length(mwX20)))/max(.001,length(mwX20));
   transformed.z+=dot(mwPush32,mwZ20.xz/max(.001,length(mwZ20)))/max(.001,length(mwZ20));
   transformed.y-=mwDrop32/max(.001,length(mwY20));
   ${k === "tree" ? `// Feuillage qui frissonne : petit mouvement rapide propre a chaque sommet.
   float mwLeaf32=fract(sin(dot(position,vec3(12.9898,78.233,37.719)))*43758.5453)*6.2831;
   float mwFlutter32=mwMask20*(.008+.04*mwForce23)*(.5+.8*mwGust23)*step(.001,uMoulinWind20);
   vec3 mwJitter32=vec3(sin(uMoulinTime20*(7.3+mwForce23*3.)+mwLeaf32),sin(uMoulinTime20*(9.1+mwForce23*2.)+mwLeaf32*1.7)*.6,cos(uMoulinTime20*(8.2+mwForce23*3.)+mwLeaf32*1.3))*mwFlutter32;
   transformed.x+=mwJitter32.x/max(.001,length(mwX20));
   transformed.y+=mwJitter32.y/max(.001,length(mwY20));
   transformed.z+=mwJitter32.z/max(.001,length(mwZ20));` : ""}
   ${h && k === "tree" ? "vMoulinLeafWorld20=mwOrigin20+mwX20*transformed.x+mwY20*transformed.y+mwZ20*transformed.z;" : ""}
  `,
      );
    }
    function le(v, k) {
      if (!v || R.has(v)) return;
      R.add(v);
      const h = v.onBeforeCompile,
        b = v.customProgramCacheKey ? v.customProgramCacheKey() : "";
      ((v.onBeforeCompile = function (p, S) {
        (h == null || h.call(this, p, S), T(p, k));
      }),
        (v.customProgramCacheKey = () => b + "|moulin-wind25-" + k),
        (v.needsUpdate = !0),
        te.materials++);
    }
    function X(v, k) {
      const h = v + ":" + k;
      if (he.has(h)) return he.get(h);
      const b = new t.MeshDepthMaterial({ depthPacking: t.RGBADepthPacking, side: k });
      return (
        (b.onBeforeCompile = (p) => T(p, v, !0)),
        (b.customProgramCacheKey = () => h + "-wind25-depth"),
        he.set(h, b),
        b
      );
    }
    function a() {
      var v, k;
      return [
        (v = n.model) == null ? void 0 : v.getObjectByName("Boisements"),
        (k = n.props) == null ? void 0 : k.group,
      ].filter(Boolean);
    }
    function _e(v = !1) {
      var S, x;
      const k = a(),
        h = k
          .map((c) =>
            c.children
              .map((P) => {
                var C;
                return P.id + ":" + (((C = P.instanceMatrix) == null ? void 0 : C.version) || 0);
              })
              .join(","),
          )
          .join("|");
      if (!v && h === O) return;
      O = h;
      let b = 0;
      const p = new Map((((S = n.forest) == null ? void 0 : S.records) || []).map((c) => [c.id, c]));
      for (const c of k)
        for (const P of c.children) {
          if (!P.isMesh || Array.isArray(P.material)) continue;
          let C = null;
          if (P.userData.treePart === 2) C = "tree";
          else if (P.userData.treePart === 0 || P.userData.treePart === 1) C = "wood";
          else if (P.name.startsWith("Objets_")) {
            const Ne = P.name.slice(P.name.lastIndexOf("_") + 1);
            [
              "leaf",
              "leafLight",
              "euca",
              "pink",
              "flower",
              "gold",
              "green",
              "rose",
              "cream",
              "yellow",
              "ivy",
              "bamboo",
              "bambooNode",
              "bambooLeaf",
              "bambooTip",
              "sedge",
            ].includes(Ne) && (C = Ne.startsWith("bamboo") ? "bamboo" : Ne === "ivy" ? "ivy" : "plant");
          }
          if (C) {
            if (C === "tree" || C === "wood") {
              const Ne = new Float32Array(Math.max(1, P.count || 1) * 2);
              for (let z = 0; z < (P.count || 1); z++) {
                const ce = p.get((x = P.userData.treeIds) == null ? void 0 : x[z]),
                  V =
                    !!ce &&
                    P.userData.treePart > 0 &&
                    ce.species === "pine" &&
                    ce.x > -52 &&
                    ce.x < -12 &&
                    ce.z > -73 &&
                    ce.z < 4;
                ((Ne[z * 2] = 0), (Ne[z * 2 + 1] = 1));
              }
              P.geometry.setAttribute("aTreeShape23", new t.InstancedBufferAttribute(Ne, 2));
            }
            (le(P.material, C), (P.customDepthMaterial = X(C, P.material.side)), (P.userData.wind20 = C), b++);
          }
        }
      te.meshes = b;
    }
    return (
      _e(!0),
      {
        uniforms: A,
        stats: te,
        sync: _e,
        update(v, k, h) {
          if (re) {
            const b = re.position.y - re.target.position.y;
            Math.abs(b) > 0.01 &&
              A.sunSlope.value.set(
                -(re.position.x - re.target.position.x) / b,
                -(re.position.z - re.target.position.z) / b,
              );
          }
          if (
            (Number.isFinite(v) && (A.time.value = v),
            (A.wind.value = Number.isFinite(k) ? Math.max(0, Math.min(1.8, k)) : 0),
            h)
          ) {
            const b = h.x ?? h[0],
              p = h.y ?? h[1];
            Number.isFinite(b) &&
              Number.isFinite(p) &&
              Math.hypot(b, p) > 0.001 &&
              A.windDirection.value.set(b, p).normalize();
          }
          // V32 : la recherche de nouveaux arbres (editeur) une fois par seconde suffit.
          const now32 = performance.now();
          if (!(now32 - (te.lastSync32 || 0) < 1e3)) ((te.lastSync32 = now32), _e());
        },
        setQuality() {},
      }
    );
  }),
  (globalThis.MoulinFinish20 = function (t, { model: n, surfaces: A, materials: re, forest: R }) {
    var h, b;
    const he = (p) => new t.Color(p).convertSRGBToLinear(),
      te = new Map(),
      O = [],
      T = {
        stone: ["#d0c9b9", "#b8b8ad", "#c1c3b9", "#c9c0aa", "#acb2ac", "#d3cbb9", "#bebbb0", "#ddd5c4"],
        paving: ["#d9cdb6", "#c2c0ad", "#e0d2b8", "#c9c7b9", "#d0bfa1", "#b8b6a8"],
        rock: ["#b7bfba", "#9ba99f", "#c2c6b9", "#8f9e9a", "#babaaa", "#a6b1a8"],
      },
      le = Object.fromEntries(Object.entries(T).map(([p, S]) => [p, S.map(he)])),
      X = new Set((R == null ? void 0 : R.materials) || []),
      a = { stone: A.stone, slate: A.slate, wood: A.wood, gravel: A.gravel },
      _e = { materials: 0, meshes: 0, recolouredVertices: 0, textures: 12, contactCount: 0, extraTriangles: 0 };
    function pe(p) {
      return /Rochers|Rocaille|Pierres_et_lichens|Rocher_|rock|Roches/.test(p.name);
    }
    n.traverse((p) => {
      if (!(!p.isMesh || !p.material || p.userData.isWater))
        for (const S of Array.isArray(p.material) ? p.material : [p.material]) {
          if (!S || X.has(S) || S.transparent || (!S.isMeshStandardMaterial && !S.isMeshLambertMaterial)) continue;
          let x = null;
          (p.name === "Dalles_de_la_terrasse"
            ? (x = "slab")
            : S === re.paving
              ? (x = "paving")
              : S === re.trim
                ? (x = "trim")
                : S === re.masonry
                  ? (x = "masonry")
                  : S === re.slate || S.map === a.slate
                    ? (x = "slate")
                    : S === re.gravel || S.map === a.gravel
                      ? (x = "gravel")
                      : S.map === A.assetRock || pe(p)
                        ? (x = "rock")
                        : S.map === a.stone
                          ? (x = "stone")
                          : S.map === a.wood
                            ? (x = "wood")
                            : p.name === "Pignon_granit" && (x = "plain-stone"),
            x && (te.has(S) || te.set(S, x), O.push({ o: p, m: S, kind: x })));
        }
    });
    function q(p) {
      ((p.roughness = 1),
        (p.metalness = 0),
        (p.metalnessMap = null),
        (p.roughnessMap = null),
        (p.envMapIntensity = 0.045));
    }
    function v(p, S, x, c) {
      var P;
      ((p.map = S), (p.normalMap = x), (P = p.normalScale) == null || P.set(c, c));
    }
    for (const [p, S] of te)
      (q(p),
        S === "slate"
          ? (v(p, A.slate20, A.slateNormal20, 0.38), p.color.copy(he("#e4edf5")), (p.roughness = 0.87))
          : S === "masonry"
            ? (v(p, A.masonry27, A.masonryNormal27, 0.72), p.color.setRGB(1, 1, 1), (p.roughness = 0.96))
            : S === "slab"
              ? (v(p, A.paver20, A.paverNormal20, 0.26), p.color.setRGB(1, 1, 1))
              : S === "paving"
                ? (v(p, A.paving20, A.pavingNormal20, 0.31), p.color.copy(he("#d7ccba")))
                : S === "gravel"
                  ? (v(p, A.gravel20, A.gravelNormal20, 0.27), p.color.copy(he("#d4c5aa")))
                  : S === "wood"
                    ? (v(p, A.wood20, A.woodNormal20, 0.13),
                      (p.roughness = 0.94),
                      p === re.wood && p.color.copy(he("#ac8b65")))
                    : S === "plain-stone"
                      ? p.color.copy(he("#c0bbac"))
                      : S === "trim"
                        ? (v(p, A.paver20, A.paverNormal20, 0.22), p.color.copy(he("#e4d8bf")))
                        : S === "rock"
                          ? (p.map && v(p, A.stone20, A.stoneNormal20, 0.19), p.vertexColors && p.color.setRGB(1, 1, 1))
                          : (v(p, A.stone20, A.stoneNormal20, 0.24),
                            p.vertexColors
                              ? p.color.setRGB(1, 1, 1)
                              : p.color.copy(he(p === re.stone ? "#bab5a5" : "#ccc5b4"))),
        (p.userData.moulinFinish20 = S),
        (p.needsUpdate = !0));
    const k = new Set();
    for (const { o: p, kind: S } of O) {
      const x = (h = p.geometry) == null ? void 0 : h.attributes.color;
      if (!x || k.has(x) || !["masonry", "stone", "slab", "rock"].includes(S)) continue;
      k.add(x);
      const c = le[S === "slab" ? "paving" : S === "rock" ? "rock" : "stone"],
        P = new Map();
      for (let C = 0; C < x.count; C++) {
        const Ne = x.getX(C),
          z = x.getY(C),
          ce = x.getZ(C),
          V = [Math.round(Ne * 1023), Math.round(z * 1023), Math.round(ce * 1023)].join(",");
        let Me = P.get(V);
        if (!Me) {
          const je = (Math.round(Ne * 1973) + Math.round(z * 1129) * 5 + Math.round(ce * 2411) * 3) >>> 0,
            lt = S === "masonry" ? P.size % c.length : je % c.length;
          ((Me = c[lt].clone()),
            S === "rock" && Me.multiplyScalar(t.MathUtils.clamp(0.87 + ((Ne + z + ce) / 3) * 0.3, 0.9, 1.07)),
            P.set(V, Me));
        }
        x.setXYZ(C, Me.r, Me.g, Me.b);
      }
      ((x.needsUpdate = !0), (_e.recolouredVertices += x.count));
    }
    for (const [p, S] of te) {
      if (!["masonry", "stone", "rock"].includes(S) || !A.finishDetail) continue;
      const x = p.onBeforeCompile,
        c = ((b = p.customProgramCacheKey) == null ? void 0 : b.call(p)) || "";
      ((p.onBeforeCompile = (P) => {
        (x == null || x(P),
          (P.uniforms.materialDetail20 = { value: A.finishDetail }),
          (P.vertexShader =
            `varying vec3 materialWorld20,materialNormal20;
` + P.vertexShader),
          (P.vertexShader = P.vertexShader.replace(
            "#include <project_vertex>",
            `#include <project_vertex>
    vec4 materialPosition20=vec4(transformed,1.0);
    #ifdef USE_INSTANCING
     materialPosition20=instanceMatrix*materialPosition20;
    #endif
    materialWorld20=(modelMatrix*materialPosition20).xyz;
    materialNormal20=inverseTransformDirection(transformedNormal,viewMatrix);`,
          )),
          (P.fragmentShader =
            `uniform sampler2D materialDetail20;varying vec3 materialWorld20,materialNormal20;
` + P.fragmentShader),
          (P.fragmentShader = P.fragmentShader.replace(
            "#include <color_fragment>",
            `#include <color_fragment>
    vec3 materialNoise20=texture2D(materialDetail20,materialWorld20.xz*.23+materialWorld20.y*vec2(.13,.21)).rgb;
    float damp20=(1.0-smoothstep(-.10,.95,materialWorld20.y));
    float moss20=smoothstep(.63,.80,materialNoise20.g)*(damp20*.38+smoothstep(.58,.98,materialNormal20.y)*.07);
    diffuseColor.rgb*=1.0-damp20*.075;
    diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.58,.67,.46),moss20);
    // Baked crevice tint, sampled from the same lightweight map.
    diffuseColor.rgb*=1.0-(1.0-smoothstep(.07,.30,materialNoise20.r))*.045;`,
          )));
      }),
        (p.customProgramCacheKey = () => c + "|moulin-painted-material20-" + S));
    }
    return (
      (A.stone = A.stone20),
      (A.stoneNormal = A.stoneNormal20),
      (A.slate = A.slate20),
      (A.slateNormal = A.slateNormal20),
      (A.wood = A.wood20),
      (A.woodNormal = A.woodNormal20),
      (A.gravel = A.gravel20),
      (A.gravelNormal = A.gravelNormal20),
      (_e.materials = te.size),
      (_e.meshes = O.length),
      { ..._e, palettes: T, materialKinds: te }
    );
  }),
  (globalThis.MoulinContacts20 = function (t, n) {
    const { model: A, ground: re, props: R, foundationFootprints: he } = n,
      te = new Uint8Array(4096 * 4);
    for (let x = 0; x < 64; x++)
      for (let c = 0; c < 64; c++) {
        const P = (x * 64 + c) * 4,
          C = Math.hypot((c - 31.5) / 31.5, (x - 31.5) / 31.5);
        ((te[P] = 33),
          (te[P + 1] = 42),
          (te[P + 2] = 27),
          (te[P + 3] = Math.round(Math.pow(Math.max(0, 1 - C), 1.6) * 145)));
      }
    const O = new t.DataTexture(te, 64, 64, t.RGBAFormat);
    ((O.needsUpdate = !0), (O.minFilter = t.LinearFilter));
    const T = new t.MeshBasicMaterial({
        map: O,
        transparent: !0,
        opacity: 0.72,
        depthWrite: !1,
        polygonOffset: !0,
        polygonOffsetFactor: -2,
      }),
      le = new t.PlaneGeometry(1, 1);
    le.rotateX(-Math.PI / 2);
    const X = new t.Group();
    ((X.name = "Ombres_de_contact_v20"), (X.userData.exportSkip = !0), A.add(X));
    let a = null,
      _e = !0;
    const pe = [],
      q = new t.Matrix4(),
      v = new t.Quaternion(),
      k = new t.Vector3(0, 1, 0),
      h = new t.Vector3(),
      b = new t.Vector3();
    A.updateMatrixWorld(!0);
    for (const [x, c] of [
      [
        "Salon_de_jardin_corail",
        [
          [0, 0.97, 2.6, 1.3],
          [-1.62, -0.12, 1.3, 1.2],
          [0.8, -1.11, 1.3, 1.2],
          [0, 0, 1.75, 1],
        ],
      ],
      [
        "Mobilier_de_la_terrasse",
        [
          [0, 0, 2.45, 1.35],
          [-0.68, -0.95, 0.55, 0.6],
          [0.68, -0.95, 0.55, 0.6],
          [-0.68, 0.95, 0.55, 0.6],
          [0.68, 0.95, 0.55, 0.6],
        ],
      ],
    ]) {
      const P = A.getObjectByName(x);
      if (P)
        for (const [C, Ne, z, ce] of c)
          (h.set(C, 0.012, Ne).applyMatrix4(P.matrixWorld),
            pe.push({ x: h.x, y: h.y, z: h.z, w: z, d: ce, a: P.rotation.y }));
    }
    for (const x of he) {
      const c = Math.cos(x.angle),
        P = Math.sin(x.angle);
      for (const [C, Ne, z, ce] of [
        [x.u0, x.v0, x.u1, x.v0],
        [x.u1, x.v0, x.u1, x.v1],
        [x.u1, x.v1, x.u0, x.v1],
        [x.u0, x.v1, x.u0, x.v0],
      ]) {
        const V = Math.hypot(z - C, ce - Ne);
        for (let Me = 0.3; Me < V; Me += 0.75) {
          const je = Me / V,
            lt = C + (z - C) * je,
            Ke = Ne + (ce - Ne) * je,
            ve = x.cx + lt * c + Ke * P,
            qe = x.cz - lt * P + Ke * c;
          pe.push({ x: ve, z: qe, y: re(ve, qe) + 0.015, w: 1.12, d: 1.12, a: 0 });
        }
      }
    }
    function p() {
      _e = !0;
    }
    function S() {
      var c;
      if (!_e) return;
      _e = !1;
      const x = pe.slice();
      for (const P of R.records) {
        if (["lierre-retombant", "mousse-rocher", "ballon", "ballons", "quad"].includes(P.type)) continue;
        const C = R.catalog.find((ce) => ce.id === P.type),
          Ne = Math.min(2, (C == null ? void 0 : C.radius) || 0.7) * P.scale,
          z = ["touffes-herbe", "fleurs-sauvages", "fougere"].includes(P.type);
        x.push({
          x: P.x,
          z: P.z,
          y: re(P.x, P.z) + 0.018,
          w: Ne * (z ? 1.1 : 1.7),
          d: Ne * (z ? 1.1 : 1.7),
          a: P.rotation,
        });
      }
      (a && (X.remove(a), (c = a.dispose) == null || c.call(a)),
        (a = new t.InstancedMesh(le, T, x.length)),
        (a.name = "Ancrage_murs_et_objets"),
        (a.frustumCulled = !1),
        (a.renderOrder = 1),
        X.add(a),
        x.forEach((P, C) => {
          (h.set(P.x, P.y, P.z), v.setFromAxisAngle(k, P.a), b.set(P.w, 1, P.d), a.setMatrixAt(C, q.compose(h, v, b)));
        }));
    }
    return (
      S(),
      {
        group: X,
        sync: p,
        update: S,
        get stats() {
          return { count: (a == null ? void 0 : a.count) || 0, draws: 1 };
        },
      }
    );
  }),
  (globalThis.MoulinLawn20 = function (t, n) {
    const A = new Set();
    return (
      n.model.traverse((re) => {
        var O, T;
        const R = re.material;
        if (!R || R.map !== n.surfaces.grass || A.has(R)) return;
        (A.add(R), (O = R.normalScale) == null || O.set(0.19, 0.19), (R.roughness = 1));
        const he = R.onBeforeCompile,
          te = ((T = R.customProgramCacheKey) == null ? void 0 : T.call(R)) || "";
        ((R.onBeforeCompile = (le) => {
          (he == null || he(le),
            (le.uniforms.lawnDetail20 = { value: n.surfaces.finishDetail }),
            (le.vertexShader =
              `varying vec3 lawnWorld20;
` + le.vertexShader),
            (le.vertexShader = le.vertexShader.replace(
              "#include <project_vertex>",
              `#include <project_vertex>
vec4 lawnP20=vec4(transformed,1.);
#ifdef USE_INSTANCING
lawnP20=instanceMatrix*lawnP20;
#endif
lawnWorld20=(modelMatrix*lawnP20).xyz;`,
            )),
            (le.fragmentShader =
              `uniform sampler2D lawnDetail20;varying vec3 lawnWorld20;
` + le.fragmentShader),
            (le.fragmentShader = le.fragmentShader.replace(
              "#include <color_fragment>",
              `#include <color_fragment>
 vec3 lawnGrain20=texture2D(lawnDetail20,lawnWorld20.xz*.15).rgb;
 float lawnPatch20=texture2D(lawnDetail20,lawnWorld20.xz*.021).g;
 diffuseColor.rgb*=mix(vec3(.92,1.11,.83),vec3(1.06,1.16,.87),smoothstep(.20,.81,lawnPatch20))*(.94+.12*lawnGrain20.b);`,
            )));
        }),
          (R.customProgramCacheKey = () => te + "|fresh-lawn20"),
          (R.needsUpdate = !0));
      }),
      { materials: A.size }
    );
  }),
  (globalThis.MoulinAmbience20 = function (t, n) {
    "use strict";
    const { root: A, camera: re, terrainHeight: R } = n,
      he = (E) => A.querySelector(E),
      te = (E, Y, w) => Math.max(Y, Math.min(w, Number.isFinite(+E) ? +E : Y)),
      O = ["Aucun", "L\xE9ger", "Mod\xE9r\xE9", "Fort", "Tr\xE8s fort"],
      T = [0, 0.3, 0.58, 0.98, 1.5],
      le = "moulin-settings-v20";
    let X = { wind: 1, volume: 0.55, sound: !1 };
    try {
      const E = JSON.parse(localStorage.getItem(le) || "null");
      E &&
        typeof E == "object" &&
        (X = { wind: te(Math.round(E.wind ?? 1), 0, 4), volume: te(E.volume ?? 0.55, 0, 1), sound: !!E.sound });
    } catch {}
    let a = X.wind,
      _e = X.volume,
      pe = !1,
      q = !1,
      v = !1,
      k = null,
      h = null,
      b = null,
      p = null,
      S = null,
      x = null,
      c = null,
      P = null,
      C = "waiting",
      Ne = 1,
      z = 0,
      ce = 0,
      V = -1 / 0,
      Me = 7,
      je = 0,
      lt = 0,
      Ke = null,
      ve = null,
      qe = 1,
      Xe = 0,
      _t = 0,
      Mt = 0,
      st = 1;
    const $ = { value: T[a] },
      U = { value: new t.Vector2(0.83, 0.56).normalize() },
      He = new t.Vector3(),
      Ce = new t.Vector3(),
      xe = [],
      H = [],
      W = [],
      D = new Float32Array(256),
      De = {},
      ke = new t.Vector3(3.62, 1.65, 5.82),
      rt = new t.Vector3(),
      $e = new t.Vector3(),
      B = [];
    for (const E of n.channels || []) {
      const Y = E.line || [];
      for (let w = 1; w < Y.length; w++) {
        const be = Y[w - 1],
          ne = Y[w];
        !Array.isArray(be) ||
          !Array.isArray(ne) ||
          B.push({
            ax: be[0],
            az: be[1],
            bx: ne[0],
            bz: ne[1],
            width: E.width || 2,
            level: Number.isFinite(E.upstreamLevel) ? E.upstreamLevel : 0,
          });
      }
    }
    const F = [];
    for (const E of n.waterRegions || [])
      for (let Y = 0, w = E.poly || []; Y < w.length; Y++) {
        const be = w[Y],
          ne = w[(Y + 1) % w.length];
        F.push({ ax: be[0], az: be[1], bx: ne[0], bz: ne[1], width: 0, level: E.level || 0 });
      }
    const g = (E, Y, w, be) => {
      E && (E.addEventListener(Y, w, be), W.push(() => E.removeEventListener(Y, w, be)));
    };
    function G() {
      X = { wind: a, volume: _e, sound: pe };
      try {
        const E = JSON.parse(localStorage.getItem(le) || "{}");
        localStorage.setItem(le, JSON.stringify({ ...E, ...X }));
      } catch {}
    }
    function Qe(E) {
      const Y = he("[data-audio-status20]");
      Y && (Y.textContent = E);
    }
    function Fe() {
      const E = he("[data-wind20]"),
        Y = he("[data-volume20]"),
        w = he("[data-volume-value20]"),
        be = he("[data-sound20]");
      (E && (E.value = String(a)),
        Y && (Y.value = String(Math.round(_e * 100))),
        w && (w.textContent = Math.round(_e * 100) + " %"),
        be &&
          (be.setAttribute("aria-pressed", String(pe)),
          (be.textContent = pe ? "Couper le son" : X.sound && !q ? "R\xE9activer le son" : "Activer le son")),
        Qe(
          pe
            ? _e === 0
              ? "Volume \xE0 z\xE9ro"
              : "Ambiance active \xB7 eau, feuillage et oiseaux"
            : "Son coup\xE9 \xB7 active-le quand tu le souhaites",
        ));
    }
    function Le(E, Y, w = 0.15) {
      !k || !E || E.setTargetAtTime(Y, k.currentTime, w);
    }
    let pt = 197921;
    function Ge() {
      return ((pt = (Math.imul(pt, 1664525) + 1013904223) >>> 0), pt / 4294967296);
    }
    function m(E, Y = 7) {
      const be = Math.round(22050 * Y),
        ne = k.createBuffer(1, be, 22050),
        K = ne.getChannelData(0);
      let fe = 0,
        Ee = 0,
        bt = 0;
      for (let mt = 0; mt < be; mt++) {
        const Ct = Ge() * 2 - 1;
        ((fe = (fe + 0.035 * Ct) / 1.017),
          (Ee = 0.88 * Ee + 0.12 * Ct),
          (bt = 0.998 * bt + 0.002 * Ct),
          (K[mt] =
            E === "brown"
              ? fe * 2.7
              : E === "pink"
                ? Ee * 1.65
                : E === "water"
                  ? ((0.6 * Ee + 0.25 * Ct) * (0.8 + 0.2 * Math.sin((mt / 22050) * 2.9)) + bt) * 1.15
                  : Ct * 0.85));
      }
      return ne;
    }
    function at(E) {
      const Y = k.createStereoPanner ? k.createStereoPanner() : k.createGain();
      return (E.connect(Y), Y.connect(h), Y);
    }
    function ft(E, Y, w, be = 0.6) {
      const ne = k.createBufferSource(),
        K = k.createBiquadFilter(),
        fe = k.createGain();
      ((ne.buffer = E),
        (ne.loop = !0),
        (K.type = Y),
        (K.frequency.value = w),
        (K.Q.value = be),
        (fe.gain.value = 0),
        ne.connect(K),
        K.connect(fe));
      const Ee = at(fe);
      ne.start();
      const bt = { source: ne, filter: K, gain: fe, pan: Ee };
      return (xe.push(bt), bt);
    }
    function ue() {
      const E = k.createGain(),
        Y = k.createBiquadFilter();
      ((E.gain.value = 0), (Y.type = "lowpass"), (Y.frequency.value = 580), (Y.Q.value = 0.35), Y.connect(E));
      const w = at(E),
        be = k.createOscillator(),
        ne = k.createOscillator(),
        K = new Float32Array(12),
        fe = new Float32Array(12);
      ((fe[1] = 0.75),
        (fe[2] = 0.35),
        (fe[3] = 0.2),
        (fe[4] = 0.16),
        (fe[6] = 0.08),
        be.setPeriodicWave(k.createPeriodicWave(K, fe)),
        (ne.type = "triangle"),
        (be.frequency.value = 42),
        (ne.frequency.value = 20.7));
      const Ee = k.createGain();
      return (
        (Ee.gain.value = 0.15),
        be.connect(Y),
        ne.connect(Ee),
        Ee.connect(Y),
        be.start(),
        ne.start(),
        xe.push({ source: be }, { source: ne }),
        { gain: E, filter: Y, pan: w, osc1: be, osc2: ne }
      );
    }
    function se() {
      const E = globalThis.MoulinAmbience20Forest;
      if (!E) {
        C = "fallback";
        return;
      }
      C = "decoding";
      try {
        fetch(E)
          .then((Y) => {
            if (!Y.ok) throw Error("Ambiance indisponible");
            return Y.arrayBuffer();
          })
          .then((Y) => k.decodeAudioData(Y))
          .then((Y) => {
            if (v || k.state === "closed") return;
            const w = Y.getChannelData(0);
            let be = 0,
              ne = 0;
            for (let fe = 0; fe < w.length; fe += 97) ((be += w[fe] * w[fe]), ne++);
            const K = Math.sqrt(be / Math.max(1, ne));
            ((Ne = te(0.008 / Math.max(1e-4, K), 0.1, 4)),
              (P = ft(Y, "lowpass", 7100, 0.4)),
              (C = "ready"),
              (V = -1 / 0));
          })
          .catch(() => {
            C = "fallback";
          });
      } catch {
        C = "fallback";
      }
    }
    function Ve() {
      if (k) return !0;
      const E = window.AudioContext || window.webkitAudioContext;
      if (!E) return (Qe("Ce navigateur ne propose pas la lecture audio 3D."), !1);
      try {
        k = new E({ latencyHint: "interactive", sampleRate: 24e3 });
      } catch {
        k = new E({ latencyHint: "interactive" });
      }
      ((h = k.createGain()), (h.gain.value = 0));
      const Y = k.createBiquadFilter(),
        w = k.createDynamicsCompressor();
      return (
        (Y.type = "highpass"),
        (Y.frequency.value = 42),
        (Y.Q.value = 0.5),
        (w.threshold.value = -17),
        (w.knee.value = 12),
        (w.ratio.value = 3),
        (w.attack.value = 0.015),
        (w.release.value = 0.2),
        (b = k.createAnalyser()),
        (b.fftSize = 512),
        h.connect(Y),
        Y.connect(w),
        w.connect(b),
        b.connect(k.destination),
        (De.brown = m("brown")),
        (De.pink = m("pink")),
        (De.water = m("water")),
        (De.step = m("white", 0.45)),
        (S = ft(De.water, "lowpass", 1300, 0.4)),
        (x = ft(De.brown, "lowpass", 420, 0.3)),
        (c = ft(De.pink, "bandpass", 1750, 0.55)),
        (p = ue()),
        se(),
        !0
      );
    }
    async function vt(E) {
      var w;
      if (((E = !!E), v)) return !1;
      const Y = ++z;
      if ((clearTimeout(Xe), E)) {
        if (!q) {
          if (!!!((w = navigator.userActivation) != null && w.isActive))
            return (Qe("Touche \xAB Activer le son \xBB pour lancer l\u2019ambiance."), !1);
          q = !0;
        }
        try {
          if (!Ve()) return !1;
          if ((await k.resume(), v || Y !== z)) return pe;
          if (k.state !== "running")
            return (Qe("Touche \xE0 nouveau \xAB Activer le son \xBB pour autoriser l\u2019audio."), !1);
        } catch {
          return (Qe("L\u2019audio n\u2019a pas d\xE9marr\xE9. R\xE9essaie depuis le bouton du son."), !1);
        }
        ((pe = !0), (V = -1 / 0), Le(h.gain, document.hidden ? 0 : _e, 0.18));
      } else {
        pe = !1;
        for (const be of H.slice()) ge(be);
        k &&
          (Le(h.gain, 0, 0.035),
          (Xe = setTimeout(() => {
            !pe && !v && k.suspend().catch(() => {});
          }, 180)));
      }
      return (G(), Fe(), pe);
    }
    function me(E) {
      return ((_e = te(E, 0, 1)), pe && k && Le(h.gain, document.hidden ? 0 : _e, 0.08), G(), Fe(), _e);
    }
    function Re(E) {
      var Y;
      return (
        typeof E == "string" && !/^\d+$/.test(E) && (E = O.findIndex((w) => w.toLowerCase() === E.toLowerCase())),
        (a = te(Math.round(+E), 0, 4)),
        G(),
        Fe(),
        (Y = n.markDirty) == null || Y.call(n),
        a
      );
    }
    function et(E) {
      const Y = E.x - re.position.x,
        w = E.z - re.position.z,
        be = Math.hypot(Y, w);
      return te((Y * Ce.x + w * Ce.z) / Math.max(4, be), -0.8, 0.8);
    }
    function kt(E) {
      return Math.hypot(E.x - re.position.x, (E.y - re.position.y) * 0.65, E.z - re.position.z);
    }
    function M(E, Y) {
      E != null && E.pan && Le(E.pan, Y, 0.12);
    }
    function ee(E) {
      var w, be;
      const Y = H.indexOf(E);
      Y >= 0 && H.splice(Y, 1);
      try {
        (E.source.disconnect(),
          E.gain.disconnect(),
          (w = E.filter) == null || w.disconnect(),
          (be = E.pan) == null || be.disconnect());
      } catch {}
    }
    function ge(E) {
      try {
        E.source.stop();
      } catch {}
      ee(E);
    }
    function ae({
      kind: E = "effect",
      buffer: Y,
      frequency: w = 600,
      type: be = "lowpass",
      duration: ne = 0.15,
      amount: K = 0.05,
      pan: fe = 0,
      delay: Ee = 0,
      oscType: bt,
      startFrequency: mt,
      endFrequency: Ct,
      pitch: Pt = 1,
    }) {
      if (!k || !pe || document.hidden || k.state !== "running" || v) return null;
      const jt = H.filter((Rt) => Rt.kind === E);
      (E === "step" && jt.length >= 3 && ge(jt[0]), H.length >= 8 && ge(H[0]));
      const Dt = k.currentTime + Ee,
        we = k.createGain(),
        We = k.createBiquadFilter(),
        yt = Y ? k.createBufferSource() : k.createOscillator();
      ((We.type = be),
        (We.frequency.value = w),
        (We.Q.value = 0.5),
        Y
          ? ((yt.buffer = Y), (yt.playbackRate.value = Pt))
          : ((yt.type = bt || "sine"),
            yt.frequency.setValueAtTime(mt || w, Dt),
            Ct && yt.frequency.exponentialRampToValueAtTime(Math.max(20, Ct), Dt + ne * 0.82)),
        we.gain.setValueAtTime(0, Dt),
        we.gain.linearRampToValueAtTime(K, Dt + 0.009),
        we.gain.exponentialRampToValueAtTime(1e-4, Dt + ne),
        yt.connect(We),
        We.connect(we));
      const Ft = at(we);
      Ft.pan && (Ft.pan.value = fe);
      const Bt = { source: yt, gain: we, filter: We, pan: Ft, kind: E };
      return (H.push(Bt), (yt.onended = () => ee(Bt)), yt.start(Dt), yt.stop(Dt + ne + 0.025), Bt);
    }
    function de(E) {
      const Y = E.surface || "grass",
        w = Y === "stone" || Y === "wood",
        be = Y === "wood";
      ((qe *= -1),
        _t++,
        ae({
          kind: "step",
          buffer: De.step,
          type: w ? "lowpass" : "bandpass",
          frequency: be ? 820 : w ? 1550 : Y === "grass" ? 900 : 1200,
          duration: w ? 0.075 : 0.13,
          amount: (w ? 0.064 : 0.044) * (E.running ? 1.15 : 1),
          pan: qe * 0.07,
          pitch: 0.85 + Ge() * 0.3,
        }),
        w &&
          ae({
            kind: "step",
            frequency: be ? 310 : 450,
            type: "lowpass",
            startFrequency: be ? 120 : 175,
            endFrequency: 80,
            duration: 0.07,
            amount: be ? 0.025 : 0.012,
            oscType: "sine",
            pan: qe * 0.07,
          }));
    }
    function oe() {
      if (!k) return;
      Mt++;
      const E = Ge() * Math.PI * 2,
        Y = 12 + Ge() * 18;
      $e.set(
        re.position.x + Math.cos(E) * Y,
        Math.max(3, (R == null ? void 0 : R(re.position.x, re.position.z)) || 0) + 5,
        re.position.z + Math.sin(E) * Y,
      );
      const w = et($e),
        be = 2200 + Ge() * 1100,
        ne = 0.011 + Ge() * 0.009;
      (ae({
        kind: "bird",
        frequency: 5800,
        type: "lowpass",
        startFrequency: be * 0.88,
        endFrequency: be * 1.24,
        duration: 0.105,
        amount: ne,
        pan: w,
      }),
        ae({
          kind: "bird",
          frequency: 5800,
          type: "lowpass",
          startFrequency: be * 1.3,
          endFrequency: be * 0.94,
          duration: 0.155,
          delay: 0.16,
          amount: ne * 0.8,
          pan: w,
        }),
        Ge() > 0.5 &&
          ae({
            kind: "bird",
            frequency: 5800,
            type: "lowpass",
            startFrequency: be,
            endFrequency: be * 1.13,
            duration: 0.08,
            delay: 0.37,
            amount: ne * 0.55,
            pan: w,
          }));
    }
    function y(E) {
      let Y = 1 / 0,
        w = null;
      const be = re.position.x,
        ne = re.position.z;
      for (const K of E) {
        const fe = K.bx - K.ax,
          Ee = K.bz - K.az,
          bt = te(((be - K.ax) * fe + (ne - K.az) * Ee) / (fe * fe + Ee * Ee || 1), 0, 1),
          mt = K.ax + fe * bt,
          Ct = K.az + Ee * bt,
          Pt = (mt - be) ** 2 + (Ct - ne) ** 2;
        Pt < Y && ((Y = Pt), (w = [mt, K.level, Ct]));
      }
      return { distance: Math.sqrt(Y), point: w };
    }
    function I() {
      var ne, K;
      const E = typeof n.player == "function" ? n.player() : n.player;
      if (!E || !E.enabled) return null;
      const Y = (ne = E.getAudioState) == null ? void 0 : ne.call(E);
      if (Y) return Y;
      const w = ((K = E.getState) == null ? void 0 : K.call(E)) || {};
      return {
        position: E.position || { x: w.x, y: w.y, z: w.z },
        speed: 0,
        running: !!w.running,
        surface: "grass",
        vehicle: null,
        rpm: 0,
        grounded: !0,
      };
    }
    function Be(E, Y) {
      if (v) return !1;
      ((Y = te(Y, 0, 0.15)), (ce += Y));
      const w = typeof n.weather == "function" ? n.weather() : n.weather,
        be = (w == null ? void 0 : w.mode) === "storm",
        live32 = globalThis.MoulinV32.windOverride,
        ne = live32 ? live32.value : Math.max(T[a], be ? 1.4 : 0),
        K =
          0.86 +
          (0.19 * Math.sin(ce * 0.67) + 0.13 * Math.sin(ce * 1.71 + 0.8) + 0.075 * Math.sin(ce * 3.08)) *
            (live32 ? 0.5 + live32.gustiness * 1.6 : 1),
        fe = te(ne * (ne > 0.6 || live32 ? K : 1), 0, 1.8),
        Ee = $.value;
      (($.value += (fe - $.value) * (1 - Math.exp(-Y * 3.4))), Math.abs(fe - $.value) < 2e-4 && ($.value = fe));
      const bt =
        (live32 ? live32.angle : 0.595) +
        Math.sin(ce * 0.14) * (0.035 + $.value * 0.085) +
        Math.sin(ce * 0.71) * $.value * 0.027;
      U.value.set(Math.cos(bt), Math.sin(bt));
      const mt = I();
      if (mt != null && mt.position) {
        const io = mt.position;
        if (Ke) {
          const po = Math.hypot(io.x - Ke.x, io.z - Ke.z);
          if (pe && k && mt.grounded !== !1 && !mt.vehicle && po < Math.max(1, Y * 14)) {
            lt += po;
            const Yo = mt.running ? 1.15 : 0.82;
            lt > Yo && ((lt %= Yo), de(mt));
          } else (mt.vehicle || po > 2) && (lt = 0);
        }
        ((Ke = { x: io.x, z: io.z }), (ve = mt.vehicle));
      } else ((Ke = null), (lt = 0), (ve = null));
      if (!pe || !k || k.state !== "running" || document.hidden || ce - V < 0.07) return Math.abs(Ee - $.value) > 1e-5;
      ((V = ce), re.getWorldDirection(He), Ce.set(-He.z, 0, He.x).normalize());
      const Ct = typeof n.weather == "function" ? n.weather() : n.weather,
        Pt = (Ct == null ? void 0 : Ct.mode) || "sun",
        jt = Pt === "rain" || Pt === "storm" ? 1 : 0,
        Dt = Pt === "snow",
        we = A.dataset.time === "soir",
        We = y(B),
        yt = y(F),
        Ft = We.distance < yt.distance + 9,
        Bt = Ft ? We : yt;
      let Rt = 0;
      if (Bt.point) {
        rt.set(...Bt.point);
        const io = kt(rt);
        ((Rt = (Ft ? 0.105 : 0.031) / (1 + (io / 10) ** 2)), M(S.pan, et(rt)));
      }
      (Le(S.gain.gain, Rt * (1 + jt * 0.3) * (1 + 0.08 * Math.sin(ce * 1.3)), 0.22),
        Le(S.filter.frequency, Ft ? 1250 : 880, 0.4));
      const qt = (R == null ? void 0 : R(re.position.x, re.position.z)) || 0,
        Kt = Math.max(0, re.position.y - qt);
      ((st = 1 / (1 + Math.max(0, Kt - 22) / 70)),
        P && Le(P.gain.gain, (Ne * st * (Dt ? 0.16 : jt ? 0.42 : we ? 0.55 : 1)) / (1 + $.value * 0.45), 0.5));
      const ro = $.value * (0.77 + 0.13 * Math.sin(ce * 0.47) + 0.1 * Math.sin(ce * 1.13));
      (Le(x.gain.gain, ($.value > 1e-4 ? 0.002 + ro * 0.052 : 0) * st, 0.35),
        Le(x.filter.frequency, 210 + ro * 490, 0.6));
      const oo = Math.max(0, Math.sin(ce * 0.81) + Math.sin(ce * 1.73) * 0.38);
      (Le(c.gain.gain, $.value * (0.012 + oo * 0.031) * st + (jt ? 0.009 : 0), 0.22),
        M(c.pan, Math.sin(ce * 0.1) * 0.3));
      const uo = (mt == null ? void 0 : mt.vehicle) === "quad" || (mt == null ? void 0 : mt.vehicle) === "car",
        Tt = te((mt == null ? void 0 : mt.rpm) || 0, 0, 1);
      (Le(p.gain.gain, uo ? 0.038 + Tt * 0.028 : 0, 0.12),
        Le(p.osc1.frequency, 41 + Tt * 70 + Math.sin(ce * 27) * 1.1, 0.055),
        Le(p.osc2.frequency, 20.7 + Tt * 34.8, 0.065),
        Le(p.filter.frequency, 420 + Tt * 850, 0.15));
      const Jt = kt(ke);
      return (
        ce > je &&
          ((je = ce + 2.7),
          Jt < 28 &&
            ae({
              kind: "wheel",
              buffer: De.pink,
              frequency: 490,
              type: "bandpass",
              duration: 0.33,
              amount: 0.04 / (1 + (Jt / 6) ** 2),
              pan: et(ke),
              pitch: 0.74,
            })),
        ce > Me &&
          ((Me = ce + 10 + Ge() * 20 + (jt ? 20 : 0) + (we ? 12 : 0)),
          !P && !Dt && a < 4 && (!jt || Ge() > 0.75) && oe()),
        Math.abs(Ee - $.value) > 1e-5
      );
    }
    function Se(E, Y = {}) {
      return v || !pe || !k
        ? !1
        : E === "footstep"
          ? (de({ ...Y, position: Y.position || re.position }), !0)
          : E === "bird"
            ? (oe(), !0)
            : E === "quad-start"
              ? (ae({
                  kind: "engine-start",
                  buffer: De.pink,
                  frequency: 480,
                  type: "lowpass",
                  duration: 0.4,
                  amount: 0.05,
                  pitch: 0.55,
                }),
                !0)
              : E === "quad-stop"
                ? (ae({
                    kind: "engine-stop",
                    frequency: 380,
                    type: "lowpass",
                    startFrequency: 90,
                    endFrequency: 36,
                    duration: 0.3,
                    amount: 0.035,
                    oscType: "triangle",
                  }),
                  !0)
                : !1;
    }
    function N() {
      var Y;
      let E = 0;
      if (b && (k == null ? void 0 : k.state) === "running") {
        b.getFloatTimeDomainData(D);
        for (const w of D) E += w * w;
        E = Math.sqrt(E / D.length);
      }
      return {
        enabled: pe,
        volume: _e,
        windLevel: a,
        windName: O[a],
        windValue: $.value,
        windTarget: Math.max(
          T[a],
          ((Y = typeof n.weather == "function" ? n.weather() : n.weather) == null ? void 0 : Y.mode) === "storm"
            ? 1.4
            : 0,
        ),
        gusting: $.value > 0.6,
        windDirection: U.value.toArray(),
        audioContext: (k == null ? void 0 : k.state) || "uninitialized",
        unlocked: q,
        procedural: !0,
        forestSource: C === "ready" ? "TinyWorlds \xB7 Forest Ambience (CC0)" : "procedural fallback",
        forestStatus: C,
        continuousSources: xe.length,
        activeVoices: H.length,
        footstepCount: _t,
        birdCount: Mt,
        vehicle: ve,
        rms: E,
      };
    }
    (g(he("[data-sound20]"), "click", (E) => {
      var Y;
      if (!E.isTrusted && !((Y = navigator.userActivation) != null && Y.isActive)) {
        Qe("Touche \xAB Activer le son \xBB pour lancer l\u2019ambiance.");
        return;
      }
      ((q = !0), vt(!pe));
    }),
      g(he("[data-volume20]"), "input", (E) => me(+E.target.value / 100)),
      g(he("[data-wind20]"), "change", (E) => Re(+E.target.value)),
      g(document, "visibilitychange", () => {
        if (!(!k || v))
          if (document.hidden) {
            for (const E of H.slice()) ge(E);
            (Le(h.gain, 0, 0.015), k.suspend().catch(() => {}), (Ke = null), (lt = 0));
          } else
            pe &&
              ((V = -1 / 0),
              k
                .resume()
                .then(() => {
                  pe && Le(h.gain, _e, 0.2);
                })
                .catch(() => {
                  Qe("Touche le bouton du son pour reprendre l\u2019ambiance.");
                }));
      }));
    function Ie() {
      if (!v) {
        ((v = !0), z++, clearTimeout(Xe), W.forEach((E) => E()));
        for (const E of H.slice()) ge(E);
        for (const E of xe)
          try {
            (E.source.stop(), E.source.disconnect());
          } catch {}
        ((xe.length = 0), k && k.close().catch(() => {}), (pe = !1));
      }
    }
    return (
      Fe(),
      {
        update: Be,
        wind: $,
        windDirection: U,
        get windLevel() {
          return a;
        },
        setWind: Re,
        setVolume: me,
        setEnabled: vt,
        getState: N,
        play: Se,
        dispose: Ie,
      }
    );
  }),
  (globalThis.MoulinAmbience20Forest = "assets/forest.b081c818ed9c.mp3"),
  (globalThis.MoulinLife20 = function (t, n) {
    "use strict";
    const { model: A, props: re } = n,
      R = 18,
      he = new Map([
        ["pot-fleuri", 0.95],
        ["arche-fleurie", 2.9],
        ["fleurs", 0.65],
        ["fleurs-sauvages", 0.7],
        ["hortensia", 1.3],
      ]),
      te = new Float32Array(R * 3),
      O = new Float32Array(R),
      T = new Float32Array(R),
      le = new t.BufferGeometry(),
      X = new t.Matrix4(),
      a = new t.Vector3();
    for (let Me = 0; Me < R; Me++) ((O[Me] = Me * 2.399963), (T[Me] = 0.38 + (Me % 5) * 0.075));
    (le.setAttribute("position", new t.BufferAttribute(te, 3).setUsage(t.DynamicDrawUsage)),
      le.setAttribute("aPhase", new t.BufferAttribute(O, 1)),
      le.setAttribute("aOrbit", new t.BufferAttribute(T, 1)),
      le.setDrawRange(0, 0));
    const _e = n.time || { value: 0 },
      pe = n.wind || { value: 0 },
      q = {
        uLifeTime: _e,
        uLifeWind: pe,
        uLifeLight: { value: 1 },
        uLifeColor: { value: new t.Color("#d6cf9d").convertSRGBToLinear() },
      },
      v = new t.ShaderMaterial({
        uniforms: q,
        transparent: !0,
        depthWrite: !1,
        depthTest: !0,
        blending: t.NormalBlending,
        toneMapped: !0,
        vertexShader: `uniform float uLifeTime,uLifeWind;attribute float aPhase,aOrbit;varying float vLifeAlpha,vFlap;void main(){
   float t=uLifeTime*.43+aPhase;vec3 p=position;
   p.x+=sin(t*.79)*aOrbit+sin(t*1.61)*.11+uLifeWind*sin(t*.45)*.1;
   p.z+=cos(t*.66)*aOrbit*.64+sin(t*1.07)*.13;
   p.y+=.16+sin(t*1.18)*.13+sin(t*.39)*.08;
   vec4 viewPosition=modelViewMatrix*vec4(p,1.0);float d=length(viewPosition.xyz);
   vLifeAlpha=(1.0-smoothstep(15.0,34.0,d))*smoothstep(.6,2.0,d);vFlap=.38+.62*abs(sin(uLifeTime*5.2+aPhase));
   gl_PointSize=clamp(55.0/max(2.0,-viewPosition.z),1.4,7.0);gl_Position=projectionMatrix*viewPosition;
  }`,
        fragmentShader: `uniform vec3 uLifeColor;uniform float uLifeLight;varying float vLifeAlpha,vFlap;void main(){
   vec2 p=gl_PointCoord*2.0-1.0;p.x/=vFlap;
   float left=length((p-vec2(-.33,0.0))/vec2(.39,.69)),right=length((p-vec2(.33,0.0))/vec2(.39,.69));
   float wings=1.0-smoothstep(.7,1.0,min(left,right));float body=(1.0-smoothstep(.07,.13,abs(p.x)))*(1.0-smoothstep(.3,.67,abs(p.y)));
   float alpha=max(wings,body*.8)*vLifeAlpha*.79;if(alpha<.035)discard;
   vec3 colour=uLifeColor*(.52+.35*uLifeLight);colour=mix(colour,colour*.57,body*.6);gl_FragColor=vec4(colour,alpha);
   #include <tonemapping_fragment>
   #include <encodings_fragment>
  }`,
      }),
      k = new t.Points(le, v);
    ((k.name = "Vie_discrete_autour_des_fleurs_v20"),
      (k.userData.exportSkip = !0),
      (k.userData.life20 = !0),
      (k.frustumCulled = !1),
      (k.castShadow = !1),
      (k.receiveShadow = !1),
      A.add(k));
    const h = typeof matchMedia == "function" && (matchMedia("(pointer:coarse)").matches || innerWidth < 680);
    let b = h ? 8 : 18,
      p = 0,
      S = 0,
      x = "",
      c = -1 / 0,
      P = null,
      C = !1;
    function Ne(Me = !1) {
      var Ke;
      const je = ((re == null ? void 0 : re.records) || []).filter((ve) => he.has(ve.type)),
        lt = je.map((ve) => `${ve.id}:${ve.type}:${ve.x}:${ve.z}:${ve.yOffset}:${ve.scale}`).join("|");
      if (!(!Me && lt === x)) {
        ((x = lt), (S = je.length), (p = Math.min(b, je.length * 3)));
        for (let ve = 0; ve < p; ve++) {
          const qe = je[Math.floor((ve * je.length) / p)],
            Xe =
              (Ke = re.group) == null
                ? void 0
                : Ke.children.find((_t) => {
                    var Mt;
                    return _t.isInstancedMesh && ((Mt = _t.userData.propIds) == null ? void 0 : Mt.includes(qe.id));
                  });
          if ((a.set(qe.x, 0, qe.z), Xe)) {
            const _t = Xe.userData.propIds.indexOf(qe.id);
            (Xe.getMatrixAt(_t, X), a.setFromMatrixPosition(X));
          }
          ((te[ve * 3] = a.x), (te[ve * 3 + 1] = a.y + he.get(qe.type) * (qe.scale || 1)), (te[ve * 3 + 2] = a.z));
        }
        ((le.attributes.position.needsUpdate = !0), le.setDrawRange(0, p), (k.visible = p > 0));
      }
    }
    function z(Me) {
      var lt;
      if (C) return !1;
      n.time || (_e.value = Me);
      const je = performance.now() * 0.001;
      return (
        je - c > 0.75 && ((c = je), Ne(!0)),
        P || (P = ((lt = A.parent) == null ? void 0 : lt.children.find((Ke) => Ke.isHemisphereLight)) || null),
        P && (q.uLifeLight.value = Math.max(0.08, Math.min(1, P.intensity / 0.9))),
        (k.visible = p > 0 && q.uLifeLight.value > 0.42),
        k.visible
      );
    }
    function ce(Me) {
      return ((b = h || Me === "fast" ? 8 : 18), Ne(!0), b);
    }
    function V() {
      ((C = !0), A.remove(k), le.dispose(), v.dispose());
    }
    return (
      Ne(!0),
      {
        group: k,
        update: z,
        setQuality: ce,
        sync: Ne,
        dispose: V,
        get stats() {
          return {
            particles: p,
            anchors: S,
            drawCalls: k.visible && p ? 1 : 0,
            maxParticles: b,
            technique: "GPU Points",
            emissive: !1,
          };
        },
      }
    );
  }),
  (globalThis.MoulinPrepareWheel20 = function (t, n) {
    const A = n.getObjectByName("Roue_a_aubes_contre_le_moulin");
    if (!A) return null;
    const re = A.getObjectByName("Rotor_mobile_du_moulin");
    if (re) return { mount: A, rotor: re };
    const R = new t.Group();
    ((R.name = "Rotor_mobile_du_moulin"), (R.userData.dynamicWater20 = !0), A.add(R));
    const he = [...A.children].filter((O) => O !== R && O.name !== "Palier_contre_le_mur"),
      te = new Map();
    for (const O of he) {
      if ((R.add(O), O.updateMatrix(), !O.isMesh)) continue;
      const T = O.material;
      (te.has(T) || te.set(T, []), te.get(T).push(O));
    }
    for (const [O, T] of te) {
      const le = [],
        X = [],
        a = [],
        _e = new t.Matrix3(),
        pe = new t.Vector3();
      for (const k of T) {
        const h = k.geometry.index ? k.geometry.toNonIndexed() : k.geometry,
          b = h.attributes.position,
          p = h.attributes.normal,
          S = h.attributes.uv;
        _e.getNormalMatrix(k.matrix);
        for (let x = 0; x < b.count; x++)
          (pe.fromBufferAttribute(b, x).applyMatrix4(k.matrix),
            le.push(pe.x, pe.y, pe.z),
            pe.fromBufferAttribute(p, x).applyMatrix3(_e).normalize(),
            X.push(pe.x, pe.y, pe.z),
            a.push(S ? S.getX(x) : 0, S ? S.getY(x) : 0));
        (h !== k.geometry && h.dispose(), (k.visible = !1), (k.userData.renderSource = !0));
      }
      const q = new t.BufferGeometry();
      (q.setAttribute("position", new t.Float32BufferAttribute(le, 3)),
        q.setAttribute("normal", new t.Float32BufferAttribute(X, 3)),
        q.setAttribute("uv", new t.Float32BufferAttribute(a, 2)),
        q.computeBoundingSphere());
      const v = new t.Mesh(q, O);
      ((v.name = "Mecanisme_rotatif_fusionne"),
        (v.castShadow = !1),
        (v.receiveShadow = !0),
        (v.userData.exportSkip = !0),
        R.add(v));
    }
    return (n.updateMatrixWorld(!0), { mount: A, rotor: R });
  }),
  (globalThis.MoulinBedTexture20 = function (t) {
    const n = document.createElement("canvas");
    n.width = n.height = 384;
    const A = n.getContext("2d");
    ((A.fillStyle = "#758b6c"), A.fillRect(0, 0, 384, 384));
    let re = 80291;
    const R = () => ((re = (Math.imul(re, 1664525) + 1013904223) >>> 0), re / 4294967296),
      he = ["#979c79", "#8c9470", "#a8a47e", "#7d8f6b", "#9b9d80", "#758466", "#a5aa8a"];
    for (let O = 0; O < 620; O++) {
      const T = R() * 384,
        le = R() * 384,
        X = 3 + Math.pow(R(), 1.6) * 14,
        a = R() * 6.28,
        _e = [],
        pe = 4 + Math.floor(R() * 3),
        q = he[Math.floor(R() * he.length)];
      for (let v = 0; v < pe; v++) {
        const k = a + (v * Math.PI * 2) / pe,
          h = X * (0.58 + R() * 0.47);
        _e.push([T + Math.cos(k) * h, le + Math.sin(k) * h * (0.65 + R() * 0.24)]);
      }
      for (const v of [-384, 0, 384])
        for (const k of [-384, 0, 384])
          if (!(T + v + X < 0 || T + v - X > 384 || le + k + X < 0 || le + k - X > 384)) {
            ((A.fillStyle = q),
              A.beginPath(),
              _e.forEach((h, b) => (b ? A.lineTo(h[0] + v, h[1] + k) : A.moveTo(h[0] + v, h[1] + k))),
              A.closePath(),
              A.fill(),
              (A.fillStyle = "rgba(206,214,162,.13)"),
              A.beginPath(),
              A.moveTo(T - 1 + v, le + k));
            for (let h = 0; h < 3; h++) A.lineTo(_e[h][0] + v, _e[h][1] + k);
            (A.closePath(), A.fill());
          }
    }
    const te = new t.CanvasTexture(n);
    return (
      (te.wrapS = te.wrapT = t.RepeatWrapping),
      (te.encoding = t.sRGBEncoding),
      (te.anisotropy = 2),
      (te.name = "Galets_facettes_du_fond"),
      te
    );
  }),
  (globalThis.MoulinWaterEffects20 = function (t, n) {
    var ft, ue;
    const {
        model: A,
        terrainHeight: re,
        waterRegions: R,
        channels: he,
        channelSample: te,
        inside: O,
        waterEffects: T,
        waterClock: le,
        mobile: X,
      } = n,
      a = new t.Group();
    ((a.name = "Details_de_l_eau_v20"), (a.userData.dynamicWater20 = !0), A.add(a));
    const _e = n.wheel || {
        mount: A.getObjectByName("Roue_a_aubes_contre_le_moulin"),
        rotor: A.getObjectByName("Rotor_mobile_du_moulin"),
      },
      pe = le || { value: 0 },
      q = { value: 0.65 },
      v = ((ft = T[0]) == null ? void 0 : ft.daylight) || { value: 1 };
    for (const se of T) se.waterWind = q;
    for (const se of n.waterMeshes || [])
      ((se.material.transparent = !0),
        (se.material.depthWrite = !1),
        (se.renderOrder = 4),
        (se.material.needsUpdate = !0));
    let k = 127630;
    const h = () => ((k = (Math.imul(k, 1664525) + 1013904223) >>> 0), k / 4294967296),
      b = new t.Vector3(),
      p = new t.Object3D(),
      S = new t.Color(),
      x = [],
      c = [];
    function P(se, Ve) {
      let vt = null;
      for (const me of R) O([se, Ve], me.poly) && (vt = { level: me.level, flow: [0, 1], width: 3 });
      for (const me of he) {
        const Re = te([se, Ve], me, me.maxWidth * 0.5 + 0.2);
        Re.distance < Re.width * 0.5 - 0.03 &&
          (!vt || Re.height > vt.level) &&
          (vt = { level: Re.height, flow: Re.flow, width: Re.width });
      }
      return vt;
    }
    function C(se, Ve, vt) {
      const me = re(se, Ve),
        Re = vt - me;
      if (Re < 0.14 || Re > 1.5) return;
      const et = 0.15 + h() * 0.3,
        kt = Math.min(et * 0.57, Re * 0.4);
      kt < 0.065 ||
        x.push({
          x: se,
          z: Ve,
          y: me + kt * 0.25,
          rx: et,
          ry: kt,
          rz: et * (0.65 + h() * 0.55),
          angle: h() * 6.28,
          shade: h(),
          distance: Math.hypot(se, Ve - 8),
        });
    }
    for (const se of R)
      for (let Ve = 0; Ve < se.poly.length; Ve++) {
        const vt = se.poly[Ve],
          me = se.poly[(Ve + 1) % se.poly.length],
          Re = me[0] - vt[0],
          et = me[1] - vt[1],
          kt = Math.hypot(Re, et);
        if (!kt) continue;
        const M = Math.ceil(kt / 2.3);
        for (let ee = 0; ee < M; ee++) {
          if (h() > 0.68) continue;
          const ge = (ee + 0.15 + h() * 0.7) / M,
            ae = vt[0] + Re * ge,
            de = vt[1] + et * ge,
            oe = 0.28 + h() * 1.25;
          for (const y of [-1, 1]) {
            const I = ae - (et / kt) * oe * y,
              Be = de + (Re / kt) * oe * y;
            if (O([I, Be], se.poly)) {
              C(I, Be, se.level);
              break;
            }
          }
        }
      }
    for (const se of he)
      for (let Ve = 0; Ve < se.line.length - 1; Ve++) {
        const vt = se.line[Ve],
          me = se.line[Ve + 1],
          Re = me[0] - vt[0],
          et = me[1] - vt[1],
          kt = Math.hypot(Re, et);
        if (!kt) continue;
        const M = Math.ceil(kt / 3);
        for (let ee = 0; ee < M; ee++) {
          if (h() > 0.64) continue;
          const ge = (ee + 0.5) / M,
            ae = vt[0] + Re * ge,
            de = vt[1] + et * ge,
            oe = te([ae, de], se),
            y = oe.width * (0.25 + h() * 0.13) * (h() < 0.5 ? -1 : 1);
          C(ae - (et / kt) * y, de + (Re / kt) * y, oe.height);
        }
      }
    x.sort((se, Ve) => se.distance - Ve.distance);
    const Ne = x.slice(0, X ? 190 : 270),
      z = new t.IcosahedronGeometry(1, 0),
      ce = new t.MeshStandardMaterial({ color: 16777215, roughness: 1, metalness: 0, flatShading: !0 }),
      V = new t.InstancedMesh(z, ce, Ne.length);
    ((V.name = "Pierres_immergees_des_berges"), (V.castShadow = !1), (V.receiveShadow = !1), (V.frustumCulled = !1));
    const Me = ["#a3ad87", "#84977a", "#aeb597", "#83988c", "#aaa786"];
    (Ne.forEach((se, Ve) => {
      (p.position.set(se.x, se.y, se.z),
        p.rotation.set(0.15 * Math.sin(Ve), se.angle, 0.1 * Math.cos(Ve)),
        p.scale.set(se.rx, se.ry, se.rz),
        p.updateMatrix(),
        V.setMatrixAt(Ve, p.matrix),
        S.set(Me[Ve % Me.length]).convertSRGBToLinear(),
        V.setColorAt(Ve, S));
    }),
      (V.instanceMatrix.needsUpdate = !0),
      Ne.length && a.add(V));
    function je(se, Ve, vt = 1.4, me = 0.8, Re = 0.35) {
      const et = P(se, Ve);
      et &&
        c.push({
          x: se,
          z: Ve,
          y: et.level + 0.017,
          length: vt,
          width: Math.min(me, et.width * 0.74),
          angle: Math.atan2(-et.flow[1], et.flow[0]),
          phase: h(),
          intensity: Re,
        });
    }
    A.updateMatrixWorld(!0);
    let lt = new t.Vector3(4.8, 0.1, 7),
      Ke = [0, 1];
    if (_e.mount) {
      lt = _e.mount.localToWorld(new t.Vector3(0, -1.37, 0.48));
      const se = P(lt.x, lt.z);
      if (se) ((lt.y = se.level + 0.03), (Ke = se.flow));
      else {
        let Ve = { distance: 1 / 0 };
        for (const vt of he) {
          const me = te([lt.x, lt.z], vt);
          me.distance < Ve.distance && (Ve = me);
        }
        Number.isFinite(Ve.distance) && ((lt.y = Ve.height + 0.03), (Ke = Ve.flow));
      }
      for (let Ve = 0; Ve < 7; Ve++) {
        const vt = (Ve % 2 ? 1 : -1) * (0.12 + h() * 0.25),
          me = 0.1 + Ve * 0.47;
        je(lt.x + Ke[0] * me - Ke[1] * vt, lt.z + Ke[1] * me + Ke[0] * vt, 1 + h() * 0.9, 0.46 + h() * 0.35, 0.8);
      }
    }
    for (const se of he)
      if (se.name === "Bief_du_moulin") {
        for (let me = 1; me < 5; me++) {
          const Re = se.line[Math.max(0, se.line.length - 1 - me)];
          je(Re[0], Re[1], 1.35, 0.72, 0.4);
        }
        const Ve = se.line[se.line.length - 2],
          vt = se.line[se.line.length - 1];
        for (const me of [0.25, 0.62, 0.92])
          je(Ve[0] + (vt[0] - Ve[0]) * me, Ve[1] + (vt[1] - Ve[1]) * me, 1.3, 0.72, 0.46);
      } else if (se.upstreamLevel - se.downstreamLevel > 0.18)
        for (let Ve = 1; Ve <= 2; Ve++) {
          const vt = Math.floor(((se.line.length - 1) * Ve) / 3),
            me = se.line[vt];
          je(me[0], me[1], 1.6, 0.48, 0.25);
        }
    const ve = new t.PlaneGeometry(1, 1);
    (ve.rotateX(-Math.PI / 2),
      ve.setAttribute(
        "phase",
        new t.InstancedBufferAttribute(Float32Array.from(c.flatMap((se) => [se.phase, se.intensity])), 2),
      ));
    const qe = new t.ShaderMaterial({
      transparent: !0,
      depthWrite: !1,
      side: t.DoubleSide,
      uniforms: { time: pe, daylight: v },
      vertexShader:
        "attribute vec2 phase;varying vec2 q;varying vec2 seed;void main(){q=uv;seed=phase;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.0);}",
      fragmentShader: `uniform float time,daylight;varying vec2 q;varying vec2 seed;void main(){vec2 p=q*2.0-1.0;float t=time*.38+seed.x*8.0;float bend=sin(p.x*4.1-t)*.19+sin(p.x*8.0+t*.7)*.065;float streak=pow(max(0.0,1.0-abs(p.y-bend)*9.0),2.0);float ribbon=pow(max(0.0,1.0-abs(p.y+.37-bend*.6)*15.0),2.0)*.60;float broken=smoothstep(-.25,.45,sin(p.x*9.0-t*1.3+seed.x*14.0));float fade=(1.0-smoothstep(.58,1.0,abs(p.x)))*(1.0-smoothstep(.7,1.0,abs(p.y)));float alpha=(streak+ribbon)*broken*fade*seed.y;if(alpha<.009)discard;vec3 c=vec3(.73,.91,.85)*(.28+.72*daylight);gl_FragColor=vec4(c,alpha);#include <tonemapping_fragment>
#include <encodings_fragment>}`,
    });
    qe.fragmentShader = qe.fragmentShader.replace(
      ";#include",
      `;
#include`,
    );
    const Xe = new t.InstancedMesh(ve, qe, c.length);
    ((Xe.name = "Ecume_discrete_aux_remous"),
      (Xe.renderOrder = 5),
      (Xe.frustumCulled = !1),
      (Xe.userData.exportSkip = !0),
      c.forEach((se, Ve) => {
        (p.position.set(se.x, se.y, se.z),
          p.rotation.set(0, se.angle, 0),
          p.scale.set(se.length, 1, se.width),
          p.updateMatrix(),
          Xe.setMatrixAt(Ve, p.matrix));
      }),
      (Xe.instanceMatrix.needsUpdate = !0),
      c.length && a.add(Xe));
    const _t = 64,
      Mt = [],
      st = [],
      $ = [];
    for (let se = 0; se < _t; se++) {
      Mt.push(lt.x + (h() - 0.5) * 0.54, lt.y, lt.z + (h() - 0.5) * 0.36);
      const Ve = (h() - 0.5) * 0.75;
      (st.push(Ke[0] * (0.35 + h() * 0.38) - Ke[1] * Ve, 0.55 + h() * 0.9, Ke[1] * (0.35 + h() * 0.38) + Ke[0] * Ve),
        $.push(h(), 0.56 + h() * 0.3));
    }
    const U = new t.BufferGeometry();
    (U.setAttribute("position", new t.Float32BufferAttribute(Mt, 3)),
      U.setAttribute("velocity", new t.Float32BufferAttribute(st, 3)),
      U.setAttribute("phase", new t.Float32BufferAttribute($, 2)));
    const He = new t.ShaderMaterial({
        transparent: !0,
        depthWrite: !1,
        uniforms: { time: pe, daylight: v },
        vertexShader:
          "uniform float time;attribute vec3 velocity;attribute vec2 phase;varying float life;void main(){life=fract(time/(phase.y+.16)+phase.x);float age=life*velocity.y/1.8;vec3 p=position+velocity*age;p.y-=1.8*age*age;vec4 v=modelViewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*v;gl_PointSize=clamp(40.0/-v.z,1.1,4.2);}",
        fragmentShader: `uniform float daylight;varying float life;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;float alpha=(1.0-smoothstep(.20,.50,d))*sin(life*3.14159)*.65;gl_FragColor=vec4(vec3(.79,.94,.91)*(.24+.76*daylight),alpha);
#include <tonemapping_fragment>
#include <encodings_fragment>}`,
      }),
      Ce = new t.Points(U, He);
    ((Ce.name = "Gouttes_de_la_roue"),
      (Ce.renderOrder = 6),
      (Ce.frustumCulled = !1),
      (Ce.visible = !!_e.rotor),
      (Ce.userData.exportSkip = !0),
      a.add(Ce));
    const xe = [],
      H = [],
      W = (se, Ve) => R.some((vt) => O([se, Ve], vt.poly));
    for (const se of he)
      for (let Ve = 0; Ve < se.line.length - 1; Ve++) {
        let de = function (oe, y) {
          if (y - oe < 0.015) return;
          const I = [vt[0] + Re * oe, vt[1] + et * oe],
            Be = [vt[0] + Re * y, vt[1] + et * y],
            Se = te(I, se),
            N = te(Be, se),
            Ie = (y - oe) * kt;
          Ie < 0.65 ||
            xe.push({
              a: [I[0], Se.height + 0.026, I[1]],
              b: [Be[0], N.height + 0.026, Be[1]],
              width: Math.min(Se.width, N.width),
              length: Ie,
              channel: se.name,
            });
        };
        var at = de;
        const vt = se.line[Ve],
          me = se.line[Ve + 1],
          Re = me[0] - vt[0],
          et = me[1] - vt[1],
          kt = Math.hypot(Re, et);
        if (kt < 0.2) continue;
        const M = Math.max(2, Math.ceil(kt / 0.7)),
          ee = -et / kt,
          ge = Re / kt;
        let ae = null;
        for (let oe = 0; oe <= M; oe++) {
          const y = oe / M,
            I = vt[0] + Re * y,
            Be = vt[1] + et * y,
            Se = te([I, Be], se),
            N = Se.width * 0.26 + 0.2,
            Ie = Number.isFinite(Se.height) && !W(I, Be) && !W(I + ee * N, Be + ge * N) && !W(I - ee * N, Be - ge * N);
          (Ie && ae === null && (ae = y),
            (!Ie || oe === M) && ae !== null && (de(ae, Ie ? y : Math.max(ae, (oe - 1) / M)), (ae = null)));
        }
      }
    for (const se of xe) {
      const Ve = se.width > 2.1 ? 3 : 2,
        vt = Math.max(1, Math.ceil(se.length / 3.3));
      for (let me = 0; me < vt; me++)
        for (let Re = 0; Re < Ve; Re++) {
          const et = (Re - (Ve - 1) * 0.5) * Math.min(se.width * 0.23, 0.8) + (h() - 0.5) * 0.15;
          H.push({
            route: se,
            phase: (me + h() * 0.75) / vt,
            offset: et,
            speed: se.channel === "Bief_du_moulin" ? 0.8 : 0.65,
            width: 0.045 + h() * 0.065,
            trail: Math.min(se.length * 0.4, 0.45 + h() * 0.75),
            seed: h(),
            priority: Math.hypot((se.a[0] + se.b[0]) * 0.5, (se.a[2] + se.b[2]) * 0.5 - 8),
          });
        }
    }
    H.sort((se, Ve) => se.priority - Ve.priority);
    const D = X ? 180 : 340,
      De = [],
      ke = new Set();
    for (const se of H) ke.has(se.route) || (De.push(se), ke.add(se.route));
    for (const se of H) {
      if (De.length >= D) break;
      De.includes(se) || De.push(se);
    }
    const rt = De.slice(0, D),
      $e = new t.PlaneGeometry(1, 1),
      B = [],
      F = [],
      g = [],
      G = [];
    for (const se of rt)
      (B.push(...se.route.a),
        F.push(...se.route.b),
        g.push(se.phase, se.offset, se.speed, se.width),
        G.push(se.trail, se.seed));
    ($e.setAttribute("currentA", new t.InstancedBufferAttribute(new Float32Array(B), 3)),
      $e.setAttribute("currentB", new t.InstancedBufferAttribute(new Float32Array(F), 3)),
      $e.setAttribute("currentShape", new t.InstancedBufferAttribute(new Float32Array(g), 4)),
      $e.setAttribute("currentDetail", new t.InstancedBufferAttribute(new Float32Array(G), 2)));
    const Qe = new t.ShaderMaterial({
        transparent: !0,
        depthWrite: !1,
        depthTest: !0,
        side: t.DoubleSide,
        uniforms: { time: pe, daylight: v },
        vertexShader:
          "uniform float time;attribute vec3 currentA,currentB;attribute vec4 currentShape;attribute vec2 currentDetail;varying vec2 vUv;varying float vFade,vSeed;void main(){vec3 d=currentB-currentA;float lengthRoute=max(.01,length(d.xz));vec3 axis=normalize(d),side=vec3(-axis.z,0.0,axis.x);float progress=fract(time*currentShape.z/lengthRoute+currentShape.x);float inset=min(.24,currentDetail.x*.54/lengthRoute);vec3 centre=mix(currentA,currentB,mix(inset,1.0-inset,progress));float wobble=sin(time*.85+currentDetail.y*21.0+progress*3.0)*.065;vec3 world=centre+axis*((uv.x-.5)*currentDetail.x)+side*(currentShape.y+wobble+(uv.y-.5)*currentShape.w*2.0);vUv=uv;vSeed=currentDetail.y;vFade=smoothstep(.0,.14,progress)*(1.0-smoothstep(.86,1.0,progress));gl_Position=projectionMatrix*modelViewMatrix*vec4(world,1.0);}",
        fragmentShader: `uniform float daylight;varying vec2 vUv;varying float vFade,vSeed;void main(){vec2 p=vUv*2.0-1.0;float soft=pow(max(0.0,1.0-p.y*p.y),2.0)*pow(max(0.0,1.0-p.x*p.x),.65);float split=.68+.32*sin(vUv.x*15.0+vSeed*9.0);float alpha=soft*split*vFade*(.19+vSeed*.16);if(alpha<.007)discard;gl_FragColor=vec4(vec3(.40,.77,.72)*(.025+.975*daylight),alpha);
#include <tonemapping_fragment>
#include <encodings_fragment>}`,
      }),
      Fe = new t.InstancedMesh($e, Qe, rt.length);
    ((Fe.name = "Courants_visibles_bief_riviere_v23"),
      (Fe.frustumCulled = !1),
      (Fe.renderOrder = 5),
      (Fe.userData.exportSkip = !0),
      (Fe.userData.night22 = !0),
      (Qe.userData.night22 = !0),
      (Fe.userData.channelOnly = !0));
    const Le = new t.Matrix4();
    for (let se = 0; se < rt.length; se++) Fe.setMatrixAt(se, Le);
    ((Fe.instanceMatrix.needsUpdate = !0), rt.length && a.add(Fe));
    const pt = {
      currentStreaks: rt.length,
      currentRoutes: xe.length,
      flowingPonds: 0,
      stones: Ne.length,
      foamPatches: c.length,
      splashPoints: _t,
      extraDraws: 4,
      wheelDraws: ((ue = _e.rotor) == null ? void 0 : ue.children.filter((se) => se.visible && se.isMesh).length) || 0,
      offscreenPasses: 0,
    };
    function Ge(se) {
      const Ve = se === "fast";
      ((Fe.count = Math.min(rt.length, Ve ? 120 : rt.length)),
        (V.count = Math.min(Ne.length, Ve ? 130 : Ne.length)),
        U.setDrawRange(0, Ve ? 32 : _t));
    }
    function m(se, Ve, vt = 0.65) {
      ((pe.value = se),
        (q.value = Math.max(
          0,
          Math.min(2, typeof vt == "number" ? vt : ((vt == null ? void 0 : vt.strength) ?? 0.65)),
        )),
        _e.rotor && (_e.rotor.rotation.x = -se * 0.28));
    }
    return {
      group: a,
      stones: V,
      foam: Xe,
      splash: Ce,
      wheel: _e,
      currents: Fe,
      reflectionHidden: [Xe, Ce, Fe],
      update: m,
      setQuality: Ge,
      stats: pt,
      contact: lt.clone(),
    };
  }),
  (globalThis.MoulinProps19 = function (t, n) {
    "use strict";
    const A = new t.Group();
    ((A.name = "Objets_du_jardin_editeur"), (A.userData.editorProps = !0), n.model.add(A));
    const re = new Set(["arbre-mort", "rocher", "groupe-rochers", "bambou", "foret-bambous", "carex"]),
      R = [],
      he = new Map(),
      te = new Map(),
      O = new Map(),
      T = new Set();
    let le = 0,
      X = null;
    const a = (B, F = {}) =>
        n.standard
          ? n.standard(B, Object.assign({ roughness: 0.96, metalness: 0, flatShading: !0, envMapIntensity: 0.04 }, F))
          : new t.MeshStandardMaterial(Object.assign({ color: B, roughness: 0.96, flatShading: !0 }, F)),
      _e = {
        wood: a("#a88961"),
        woodDark: a("#705439"),
        bark: a("#746951"),
        cut: a("#c0a77b"),
        metal: a("#485953"),
        metalLight: a("#acb4ae"),
        canvas: a("#e5d6b0"),
        coral: a("#c57b67"),
        green: a("#608754"),
        leaf: a("#648b40", { side: t.DoubleSide }),
        leafLight: a("#97b24e", { side: t.DoubleSide }),
        euca: a("#799c8d", { side: t.DoubleSide }),
        clay: a("#ac7355"),
        soil: a("#61503b"),
        pink: a("#d9909f"),
        flower: a("#eee1c3"),
        gold: a("#d9b05d"),
        tyre: a("#2b302f"),
        quad: a("#5b6b30", { roughness: 0.5, metalness: 0.05, flatShading: !1 }),
        quadDark: a("#262b2c"),
        quadSeat: a("#141617", { roughness: 0.86, flatShading: !1 }),
        quadChrome: a("#aab2ab", { roughness: 0.42, metalness: 0.55 }),
        quadLamp: a("#f2f6e8", { roughness: 0.3, emissive: 5855570, emissiveIntensity: 0.6 }),
        quadRed: a("#b3322c", { emissive: 4194304, emissiveIntensity: 0.5 }),
        glass: a("#c4e2df", { roughness: 0.48 }),
        ember: a("#c98742", { emissive: 9056267, emissiveIntensity: 0.35 }),
        white: a("#e4e8d9"),
        blue: a("#809ea8"),
      };
    (Object.assign(_e, {
      bamboo: a("#798c4e"),
      bambooNode: a("#b5b087"),
      bambooLeaf: a("#547b47", { side: t.DoubleSide }),
      bambooTip: a("#88a15e", { side: t.DoubleSide }),
      sedge: a("#81905b", { side: t.DoubleSide }),
    }),
      (_e.deadTint = a("#ffffff")),
      (_e.rockTint = a("#ffffff")),
      (_e.rose = a("#d990ac", { side: t.DoubleSide })),
      (_e.cream = a("#f1ebcf", { side: t.DoubleSide })),
      (_e.yellow = a("#e2c360", { side: t.DoubleSide })),
      (_e.ivy = a("#618647", { side: t.DoubleSide })));
    const pe = Math.PI * 2,
      q = new t.Vector3(0, 1, 0),
      v = new t.Object3D(),
      k = new t.Matrix4(),
      h = new t.Quaternion(),
      b = new t.Vector3(),
      p = new t.Vector3(),
      S = {
        box: new t.BoxGeometry(1, 1, 1),
        cyl: new t.CylinderGeometry(1, 1, 1, 8),
        cone: new t.ConeGeometry(1, 1, 8),
        ico: new t.IcosahedronGeometry(1, 0),
        ico1: new t.IcosahedronGeometry(1, 1),
        sphere: new t.SphereGeometry(1, 10, 7),
      },
      x = (B, F = "#819a6e") =>
        '<svg viewBox="0 0 64 48" fill="none" xmlns="http://www.w3.org/2000/svg"><ellipse cx="32" cy="42" rx="25" ry="3" fill="#cad5c3" opacity=".5"/><g fill="' +
        F +
        '" stroke="#506550" stroke-width="1.7" stroke-linejoin="round">' +
        B +
        "</g></svg>",
      c = {
        chair: x('<path d="M18 9h9v21h22v6H21z"/><path d="M23 35v9m21-9v9"/>', "#be9872"),
        lounger: x('<path d="m8 12 7-2 14 21h25v6H24z"/><path d="M25 37v6m25-6v6"/>', "#dbbe96"),
        vase: x(
          '<path d="M26 7h12l-2 10q16 6 10 18-5 10-14 9-10 0-14-9-6-12 10-18z"/><path d="M24 18q-15-1-11 10l6 4m21-14q15-1 11 10l-6 4"/>',
          "#bc8a64",
        ),
        arch: x(
          '<path d="M13 44V20a19 19 0 0 1 38 0v24h-5V21a14 14 0 0 0-28 0v23z"/><circle cx="16" cy="16" r="7"/><circle cx="28" cy="7" r="7"/><circle cx="42" cy="10" r="8"/><circle cx="49" cy="24" r="7"/>',
        ),
        fern: x(
          '<path d="M31 43Q13 13 4 22l11 8-10 2 19 4M33 43Q45 12 60 20l-14 9 14 2-20 7M32 43V10l-9 9 7 5-9 4 10 4m2-19 9 6-7 5 10 4-10 5"/>',
        ),
        tree: x(
          '<path d="m27 42 3-23h5l3 23z" fill="#9a7d58"/><path d="m13 18 8-11 17-4 13 10 2 12-14 5-12-2-15-1z"/>',
        ),
        shelter: x(
          '<path d="M10 20h44L32 5z" fill="#d1c2a1"/><path d="M14 20v24m36-24v24m-28-24v17m20-17v17"/>',
          "#bd9d74",
        ),
        fire: x(
          '<path d="M15 29h34l-6 11H21z"/><path d="m22 40-3 4m23-4 3 4"/><path d="M26 29q-7-9 6-19 0 8 6 7 9 7-1 12" fill="#d6a15a"/>',
          "#787767",
        ),
        quad: x(
          '<path d="M11 23h40l-3 12H15zM20 16h13l6 8H17z"/><circle cx="16" cy="35" r="7" fill="#4d5850"/><circle cx="47" cy="35" r="7" fill="#4d5850"/><path d="m36 21 4-11 7 1"/>',
        ),
        balloon: x(
          '<ellipse cx="29" cy="17" rx="12" ry="14" fill="#ce8a7d"/><ellipse cx="44" cy="19" rx="9" ry="12" fill="#d6bd7d"/><path d="m28 31 7 13 8-13"/>',
        ),
        log: x(
          '<path d="m8 32 39-18 10 14-39 17z"/><ellipse cx="13" cy="37" rx="7" ry="9" fill="#c3a883"/><path d="m31 22-3-10 6-3 2 11"/>',
          "#8b7758",
        ),
      };
    ((c.dead = x('<path d="m28 43 3-36 4 36zm5-20L16 12l-4-9m21 27 17-12 5-12M21 16l2-10m19 18 2-13"/>', "#b6ab92")),
      (c.rock = x(
        '<path d="m7 35 7-20 17-6 18 9 8 18-17 7-21-1z"/><path d="m14 15 19 11 16-8M7 35l26-9 7 17"/>',
        "#a4a79b",
      )),
      (c.hydrangea = x(
        '<path d="M30 43V23m2 14L17 30m15 5 15-6" stroke="#537646"/><ellipse cx="20" cy="30" rx="10" ry="5" fill="#749955"/><ellipse cx="43" cy="29" rx="10" ry="5" fill="#83a65b"/><g fill="#dba9c5"><circle cx="22" cy="17" r="10"/><circle cx="35" cy="12" r="10"/><circle cx="45" cy="21" r="10"/><circle cx="30" cy="25" r="10"/></g><g fill="#f1d1e0" stroke="none"><circle cx="19" cy="15" r="3"/><circle cx="34" cy="10" r="3"/><circle cx="44" cy="19" r="3"/><circle cx="30" cy="23" r="3"/></g>',
      )));
    const C = [
        [
          "bambou",
          "Bambous en touffe",
          "V\xE9g\xE9tation",
          1.1,
          4.9,
          "Cannes noueuses et feuillage fin. Quatre silhouettes et couleurs r\xE9glables.",
          c.tree,
        ],
        [
          "foret-bambous",
          "For\xEAt de bambous",
          "V\xE9g\xE9tation",
          3.8,
          6.4,
          "Un bosquet de 23 cannes. Peignez plusieurs bosquets avec un espacement de 5 \xE0 7 m.",
          c.tree,
        ],
        [
          "carex",
          "La\xEEche \xB7 Carex",
          "V\xE9g\xE9tation",
          0.9,
          0.9,
          "Touffe de feuilles arqu\xE9es et \xE9pis discrets. \xC0 planter sur la berge, seule ou en ruban.",
          c.fern,
        ],
        [
          "arbre-mort",
          "Arbre mort debout",
          "V\xE9g\xE9tation",
          2.15,
          5.8,
          "Arbre sans feuillage, branches irr\xE9guli\xE8res et racines. Bois recolorable.",
          c.dead,
        ],
        [
          "rocher",
          "Rocher",
          "Jardin",
          1.25,
          1.4,
          "Rocher \xE0 facettes. Quatre silhouettes, couleur et taille r\xE9glables.",
          c.rock,
        ],
        [
          "groupe-rochers",
          "Groupe de rochers",
          "Jardin",
          2.1,
          1.35,
          "Trois rochers partiellement enterr\xE9s, ajustables en un seul groupe.",
          c.rock,
        ],
        [
          "touffes-herbe",
          "Touffes d\u2019herbe",
          "V\xE9g\xE9tation",
          0.75,
          0.6,
          "Herbes en \xE9ventail, volumes fins et teintes fra\xEEches.",
          c.fern,
        ],
        [
          "fleurs-sauvages",
          "Fleurs champ\xEAtres",
          "V\xE9g\xE9tation",
          0.95,
          0.75,
          "Marguerites cr\xE8me, fleurs roses et boutons jaunes.",
          c.fern,
        ],
        [
          "hortensia",
          "Hortensia",
          "V\xE9g\xE9tation",
          1.15,
          1.38,
          "Grandes feuilles et bouquets roses, bleus, cr\xE8me ou mauves. \xC0 planter seul ou en massif.",
          c.hydrangea,
        ],
        [
          "lierre-retombant",
          "Lierre retombant",
          "V\xE9g\xE9tation",
          0.65,
          1.05,
          "Place son point d\u2019ancrage en haut d\u2019un mur : les tiges descendent.",
          c.fern,
        ],
        [
          "mousse-rocher",
          "Mousse basse",
          "V\xE9g\xE9tation",
          0.85,
          0.18,
          "Tapis v\xE9g\xE9tal bas au pied d\u2019un mur ou d\u2019un rocher.",
          c.fern,
        ],
        [
          "transat",
          "Transat",
          "Mobilier",
          1.25,
          1.06,
          "Dossier inclin\xE9, toile \xE9crue et structure en bois.",
          c.lounger,
        ],
        [
          "chaise",
          "Chaise de jardin",
          "Mobilier",
          0.52,
          0.95,
          "Chaise l\xE9g\xE8re en bois et assise claire.",
          c.chair,
        ],
        ["table", "Table de jardin", "Mobilier", 1.35, 0.76, "Grande table en lattes de bois.", c.chair],
        ["banc", "Banc en bois", "Mobilier", 1.12, 0.94, "Banc \xE0 dossier pour deux personnes.", c.chair],
        ["canape", "Canap\xE9 corail", "Mobilier", 1.45, 0.92, "Canap\xE9 trois places et coussins corail.", c.lounger],
        [
          "parasol",
          "Parasol en toile",
          "Mobilier",
          1.8,
          2.65,
          "Toile \xE9crue ouverte sur un pied central.",
          c.shelter,
        ],
        ["amphore", "Amphore", "Jardin", 0.52, 1.12, "Poterie en terre cuite avec deux anses.", c.vase],
        ["pot-fleuri", "Pot fleuri", "Jardin", 0.65, 1.05, "Grand pot de terre cuite, feuillage et fleurs.", c.vase],
        [
          "arche-fleurie",
          "Arche fleurie",
          "Jardin",
          1.75,
          3.05,
          "Passage libre sous une arche de feuillage et de fleurs.",
          c.arch,
        ],
        ["tonnelle", "Tonnelle", "Jardin", 2.75, 3.2, "Abri ouvert, quatre poteaux et toiture en toile.", c.shelter],
        ["brasero", "Brasero", "Jardin", 0.65, 0.74, "Vasque m\xE9tallique, b\xFBches et braises douces.", c.fire],
        [
          "parasol-chauffant",
          "Parasol chauffant",
          "Jardin",
          0.65,
          2.35,
          "Chauffage de terrasse avec r\xE9flecteur m\xE9tallique.",
          c.fire,
        ],
        [
          "bosquet",
          "Bosquet",
          "V\xE9g\xE9tation",
          1.55,
          1.8,
          "Petit groupe irr\xE9gulier d\u2019arbustes bas.",
          c.tree,
        ],
        ["fougere", "Foug\xE8re", "V\xE9g\xE9tation", 0.7, 0.68, "Frondes d\xE9coup\xE9es en \xE9ventail.", c.fern],
        [
          "massif-fougeres",
          "Massif de foug\xE8res",
          "V\xE9g\xE9tation",
          2.2,
          0.85,
          "Neuf foug\xE8res regroup\xE9es, un seul lot de rendu.",
          c.fern,
        ],
        [
          "grand-massif-fougeres",
          "Sous-bois de foug\xE8res",
          "V\xE9g\xE9tation",
          3.75,
          0.95,
          "Vingt-quatre foug\xE8res denses pour les sous-bois.",
          c.fern,
        ],
        [
          "fougeres-sauvages",
          "Grandes foug\xE8res sauvages",
          "V\xE9g\xE9tation",
          2.05,
          1.12,
          "Sous-bois : sept foug\xE8res aux longues frondes d\xE9ploy\xE9es. \xC0 peindre au pied des arbres.",
          c.fern,
        ],
        [
          "roncier",
          "Roncier sauvage",
          "V\xE9g\xE9tation",
          1.58,
          1.24,
          "Sous-bois : tiges arqu\xE9es, petites \xE9pines et feuilles dentel\xE9es. Traversable et sensible au vent.",
          c.fern,
        ],
        [
          "lierre-sol",
          "Tapis de lierre",
          "V\xE9g\xE9tation",
          1.55,
          0.22,
          "Sous-bois : lianes rampantes et feuilles pliss\xE9es pour habiller le pied des arbres.",
          c.fern,
        ],
        [
          "sous-bois-mixte",
          "Sous-bois m\xE9lang\xE9",
          "V\xE9g\xE9tation",
          2.08,
          1.08,
          "Foug\xE8res, ronces et orties r\xE9unies dans un seul massif. Peindre, d\xE9placer ou redimensionner.",
          c.fern,
        ],
        [
          "eucalyptus",
          "Eucalyptus",
          "V\xE9g\xE9tation",
          2.8,
          7.9,
          "Tronc clair et feuillage bleu-vert l\xE9ger.",
          c.tree,
        ],
        [
          "fleurs",
          "Massif fleuri",
          "V\xE9g\xE9tation",
          1.3,
          0.65,
          "Fleurs roses et cr\xE8me sur un feuillage bas.",
          c.fern,
        ],
        [
          "tronc-mort",
          "Tronc mort",
          "D\xE9coration",
          1.75,
          0.72,
          "Tronc couch\xE9 avec d\xE9parts de branches et bois de coupe.",
          c.log,
        ],
        ["souche", "Souche", "D\xE9coration", 0.65, 0.75, "Souche courte et racines apparentes.", c.log],
        ["ballon", "Ballon", "D\xE9coration", 0.45, 2, "Ballon corail attach\xE9 \xE0 un piquet discret.", c.balloon],
        [
          "ballons",
          "Bouquet de ballons",
          "D\xE9coration",
          0.9,
          2.6,
          "Trois ballons corail, cr\xE8me et bleu-gris.",
          c.balloon,
        ],
        ["quad", "Quad", "D\xE9coration", 1.45, 1.38, "Quad de jardin olive, quatre roues et guidon.", c.quad],
      ].map((B) => ({
        id: B[0],
        label: B[1],
        category: B[2],
        radius: B[3],
        height: B[4],
        description: B[5],
        icon: B[6],
        defaultScale: 1,
      })),
      Ne = {
        hortensia: "#d990ac",
        parasol: "#e5d6b0",
        "arbre-mort": "#b6a58b",
        rocher: "#a4a79b",
        "groupe-rochers": "#a4a79b",
        "tronc-mort": "#746951",
        souche: "#746951",
      };
    for (const B of C)
      Ne[B.id] &&
        Object.assign(B, {
          colorable: !0,
          defaultColor: Ne[B.id],
          colorPalette: ["#b6a58b", "#e7e2d5", "#d0cbbb", "#9b8062", "#838579"],
          variants: re.has(B.id) ? ["Forme 1", "Forme 2", "Forme 3", "Forme 4"] : void 0,
        });
    const z = new Map(C.map((B) => [B.id, B]));
    (Object.assign(z.get("pot-fleuri"), {
      colorable: !0,
      defaultColor: "#d9909f",
      tintKeys: ["pink", "flower"],
      colorPalette: ["#cc7f91", "#dfc987", "#c5b2da", "#e6debf"],
    }),
      (z.get("arbre-mort").variants = ["Branches ouvertes", "Fourche", "Branches \xE9tal\xE9es", "Arbre du jardin"]));
    for (const B of ["rocher", "groupe-rochers"]) z.get(B).variants = ["Compact", "Vertical", "Plat", "Irr\xE9gulier"];
    (Object.assign(z.get("hortensia"), {
      tintKeys: ["rose", "pink"],
      variantColors: ["#d990ac", "#91b4d8", "#eee6d1", "#b4a0cb"],
      colorPalette: ["#d990ac", "#91b4d8", "#eee6d1", "#b4a0cb"],
      variants: ["Fleurs roses", "Fleurs bleues", "Fleurs cr\xE8me", "Fleurs mauves"],
      keywords: "hortensia hortensias hydrangea fleurs massif buisson",
    }),
      Object.assign(z.get("parasol"), {
        tintKeys: ["canvas"],
        variantColors: ["#e5d6b0", "#cf665d", "#8eaa8c", "#87a4b5"],
        colorPalette: ["#e5d6b0", "#cf665d", "#8eaa8c", "#87a4b5"],
        variants: ["Toile \xE9crue", "Toile corail", "Toile sauge", "Toile bleu gris\xE9"],
      }));
    for (const B of ["bambou", "foret-bambous", "carex"])
      Object.assign(z.get(B), {
        family: B === "carex" ? "Berges" : "Bambous",
        keywords:
          B === "carex"
            ? "carex laiche la\xEEche \xE9tang berge touffe"
            : "bambou bambous bambouseraie for\xEAt foret bosquet",
        colorable: !0,
        defaultColor: B === "carex" ? "#81905b" : "#547b47",
        tintKeys: B === "carex" ? ["sedge"] : ["bambooLeaf", "bambooTip"],
        variants: ["Naturel", "Plus ouvert", "Irr\xE9gulier", "\xC9lanc\xE9"],
        colorPalette: ["#547b47", "#81905b", "#9aa86a", "#557867"],
      });
    const ce = ["fougeres-sauvages", "roncier", "lierre-sol", "sous-bois-mixte"];
    for (const B of ["fougere", "massif-fougeres", "grand-massif-fougeres", "lierre-retombant", "mousse-rocher", ...ce])
      Object.assign(z.get(B), {
        family: "Sous-bois",
        keywords: "sous-bois sous bois foug\xE8res fougeres ronces roncier lierre orties v\xE9g\xE9tation woodland",
      });
    for (const B of ce)
      Object.assign(z.get(B), {
        colorable: !0,
        defaultColor: "#648b40",
        tintKeys: ["leaf", "leafLight", "ivy"],
        variantColors: ["#648b40", "#41663a", "#86954b", "#a18648"],
        colorPalette: ["#648b40", "#41663a", "#86954b", "#a18648"],
        variants: ["Vert frais", "Vert de sous-bois", "Vert olive", "Fin d\u2019\xE9t\xE9"],
      });
    const V = (B, F = 0) => B + (re.has(B) ? ":" + (F % 4) : "");
    function Me(B, F = 0) {
      const g = V(B, F);
      if (te.has(g)) return te.get(g);
      const G = new Map(),
        Qe = [];
      function Fe(oe, y, I = [0, 0, 0], Be = [1, 1, 1], Se = [0, 0, 0], N = 1) {
        const Ie = oe.index ? oe.toNonIndexed() : oe.clone();
        (v.position.set(...I), v.rotation.set(...Se), v.scale.set(...Be), v.updateMatrix(), Ie.applyMatrix4(v.matrix));
        const E = Ie.attributes.position,
          Y = Ie.attributes.normal,
          w = new Float32Array(E.count * 3);
        for (let be = 0; be < w.length; be++) w[be] = N;
        (Ie.setAttribute("color", new t.BufferAttribute(w, 3)),
          Y || Ie.computeVertexNormals(),
          G.has(y) || G.set(y, []),
          G.get(y).push(Ie));
      }
      function Le(oe, y, I, Be = [0, 0, 0], Se = 1) {
        Fe(S.box, oe, y, I, Be, Se);
      }
      function pt(oe, y, I, Be = 0, Se = 1) {
        Fe(Be ? S.ico1 : S.ico, oe, y, I, [0.07, 0.25, -0.1], Se);
      }
      function Ge(oe, y, I, Be = 0.04, Se = Be, N = 7) {
        const Ie = new t.Vector3(...y),
          E = new t.Vector3(...I),
          Y = new t.CylinderGeometry(Se, Be, Ie.distanceTo(E), N);
        (Y.applyMatrix4(
          new t.Matrix4().makeRotationFromQuaternion(
            new t.Quaternion().setFromUnitVectors(q, E.clone().sub(Ie).normalize()),
          ),
        ),
          Fe(Y, oe, Ie.add(E).multiplyScalar(0.5).toArray()),
          Y.dispose());
      }
      function m(oe, y, I, Be, Se = [0, 0, 0], N = pe) {
        const Ie = new t.TorusGeometry(I, Be, 5, 14, N);
        (Fe(Ie, oe, y, [1, 1, 1], Se), Ie.dispose());
      }
      function at(oe, y) {
        Qe.push(new t.Box3(new t.Vector3(...oe), new t.Vector3(...y)));
      }
      function ft(oe, y, I, Be = "wood", Se = 0.06) {
        for (const N of [-oe / 2, oe / 2]) for (const Ie of [-y / 2, y / 2]) Le(Be, [N, I / 2, Ie], [Se, I, Se]);
      }
      function ue(oe, y, I, Be = 1, Se = 0) {
        for (let N = 0; N < 7; N++) {
          const Ie = N * 2.39996 + Se,
            E = (N % 3) * 0.1 * Be,
            Y = oe + Math.cos(Ie) * E,
            w = I + Math.sin(Ie) * E,
            be = y + (0.05 + 0.1 * (N % 3)) * Be;
          (Ge("green", [Y, y - 0.28 * Be, w], [Y, be, w], 0.009 * Be),
            pt(N % 3 ? "pink" : "flower", [Y, be, w], [0.105 * Be, 0.055 * Be, 0.105 * Be], 0, 0.93 + (N % 3) * 0.04),
            pt("gold", [Y, be + 0.035 * Be, w], [0.036 * Be, 0.029 * Be, 0.036 * Be]));
        }
      }
      function se(oe, y, I, Be = 0) {
        Ge("bark", [oe, 0.03, y], [oe, 0.7 * I, y], 0.06 * I, 0.025 * I);
        for (let Se = 0; Se < 5; Se++) {
          const N = Se * 2.39996 + Be;
          pt(
            Se % 2 ? "leaf" : "leafLight",
            [oe + Math.sin(N) * 0.35 * I, (0.6 + (Se % 3) * 0.14) * I, y + Math.cos(N) * 0.33 * I],
            [0.58 * I, 0.53 * I, 0.49 * I],
            1,
            0.88 + (Se % 4) * 0.035,
          );
        }
      }
      function Ve(oe, y, I = 1) {
        const Be = [
            [0.16, 0],
            [0.23, 0.04],
            [0.3, 0.36],
            [0.34, 0.51],
            [0.34, 0.58],
            [0.29, 0.6],
          ].map((N) => new t.Vector2(N[0] * I, N[1] * I)),
          Se = new t.LatheGeometry(Be, 10);
        (Fe(Se, "clay", [oe, 0, y]),
          Se.dispose(),
          Fe(S.cyl, "soil", [oe, 0.56 * I, y], [0.285 * I, 0.04 * I, 0.285 * I]));
      }
      function vt(oe, y, I = 1, Be = 0) {
        const Se = [],
          N = [];
        function Ie(Y, w, be, ne) {
          Se.push(...Y, ...w, ...be);
          for (let K = 0; K < 3; K++) N.push(ne, ne, ne);
        }
        for (let Y = 0; Y < 8; Y++) {
          const w = (Y * pe) / 8 + Be,
            be = (0.52 + 0.15 * Math.sin(Y * 1.7 + Be)) * I,
            ne = Math.cos(w),
            K = Math.sin(w),
            fe = -K,
            Ee = ne,
            bt = (Ct) => [
              oe + ne * be * Ct,
              0.06 * I + Math.sin(Ct * Math.PI * 0.76) * (0.46 + 0.08 * Math.cos(Y)) * I,
              y + K * be * Ct,
            ];
          let mt = bt(0);
          for (let Ct = 1; Ct <= 8; Ct++) {
            const Pt = Ct / 9,
              jt = bt(Pt),
              Dt = bt(Math.min(0.99, Pt + 0.095)),
              we = 0.007 * I;
            Ie([mt[0] - fe * we, mt[1], mt[2] - Ee * we], [mt[0] + fe * we, mt[1], mt[2] + Ee * we], jt, 0.83);
            const We = (Math.sin(Pt * Math.PI) * 0.14 + 0.014) * I;
            for (const yt of [-1, 1]) {
              const Ft = [
                  jt[0] + fe * We * yt - ne * 0.025 * I,
                  jt[1] + 0.015 * I,
                  jt[2] + Ee * We * yt - K * 0.025 * I,
                ],
                Bt = [
                  jt[0] + fe * We * 0.42 * yt + ne * 0.026 * I,
                  jt[1] + 0.025 * I,
                  jt[2] + Ee * We * 0.42 * yt + K * 0.026 * I,
                ];
              (Ie(jt, Ft, Bt, 0.9 + 0.06 * Math.sin(Y + Ct)), Ie(Bt, Ft, Dt, 0.91 + 0.05 * Math.sin(Y + Ct)));
            }
            mt = jt;
          }
        }
        const E = new t.BufferGeometry();
        (E.setAttribute("position", new t.Float32BufferAttribute(Se, 3)),
          E.setAttribute("color", new t.Float32BufferAttribute(N, 3)),
          E.computeVertexNormals(),
          G.has("leaf") || G.set("leaf", []),
          G.get("leaf").push(E));
      }
      function me(oe, y, I, Be, Se, N = "leaf", Ie = 1, E = !0) {
        const Y = new t.Vector3(...oe),
          w = new t.Vector3(Math.sin(y), Se, Math.cos(y)),
          be = new t.Vector3(Math.cos(y), 0, -Math.sin(y)),
          ne = [],
          K = (mt) =>
            Y.clone()
              .addScaledVector(w, I * mt)
              .add(new t.Vector3(0, Math.sin(mt * Math.PI) * Be * 0.16, 0)),
          fe = K(0.48),
          Ee = [K(0)];
        for (const mt of [-1, 1])
          for (let Ct = 1; Ct <= 6; Ct++) {
            const Pt = mt < 0 ? Ct / 7 : 1 - Ct / 7,
              jt = K(Pt),
              Dt = Math.sin(Pt * Math.PI) * Be * (E ? (Ct % 2 ? 0.8 : 1.08) : 1);
            (jt.addScaledVector(be, mt * Dt), (jt.y -= Dt * 0.24), Ee.push(jt), mt < 0 && Ct === 6 && Ee.push(K(1)));
          }
        for (let mt = 0; mt < Ee.length; mt++)
          ne.push(...fe.toArray(), ...Ee[mt].toArray(), ...Ee[(mt + 1) % Ee.length].toArray());
        const bt = new t.BufferGeometry();
        (bt.setAttribute("position", new t.Float32BufferAttribute(ne, 3)),
          bt.computeVertexNormals(),
          Fe(bt, N, [0, 0, 0], [1, 1, 1], [0, 0, 0], Ie),
          bt.dispose());
      }
      function Re(oe, y, I = 1, Be = 0, Se = 7) {
        for (let N = 0; N < Se; N++) {
          const Ie = N * 2.39996 + Be,
            E = (0.75 + (N % 3) * 0.16) * I,
            Y = Math.sin(Ie),
            w = Math.cos(Ie),
            be = (0.66 + (N % 3) * 0.16) * I,
            ne = (fe) => [oe + Y * E * fe, 0.04 * I + Math.sin(fe * Math.PI * 0.88) * be, y + w * E * fe];
          let K = ne(0);
          for (let fe = 1; fe <= 5; fe++) {
            const Ee = fe / 5,
              bt = ne(Ee);
            if ((Ge("green", K, bt, 0.012 * I, 0.009 * I, 4), fe < 5)) {
              const mt = fe % 2 ? 1 : -1,
                Ct = Ie + mt * 1.1,
                Pt = [bt[0] + Math.sin(Ct) * 0.09 * I, bt[1] + 0.045 * I, bt[2] + Math.cos(Ct) * 0.09 * I];
              Ge("green", bt, Pt, 0.006 * I, 0.004 * I, 3);
              for (let jt = -1; jt <= 1; jt++)
                me(
                  Pt,
                  Ct + jt * 0.73,
                  (jt === 0 ? 0.235 : 0.185) * I,
                  0.078 * I,
                  0.14,
                  (N + fe + jt) % 3 ? "leaf" : "leafLight",
                  0.7 + (N % 4) * 0.07,
                  !0,
                );
            }
            ((fe === 2 || fe === 4) &&
              M(bt, [bt[0] - Y * 0.045 * I, bt[1] + 0.04 * I, bt[2] - w * 0.045 * I], 0.012 * I, "green", 0.82),
              (K = bt));
          }
        }
      }
      function et(oe, y, I = 0.65, Be = 0) {
        const Se = Math.sin(Be) * 0.1,
          N = [oe + Se, I, y + 0.06];
        Ge("green", [oe, 0.02, y], N, 0.01, 0.004, 4);
        for (let Ie = 0; Ie < 4; Ie++)
          for (const E of [-1, 1]) {
            const Y = 0.24 + Ie * 0.17,
              w = [oe + Se * Y, I * Y, y + 0.06 * Y],
              be = Be + Ie * 0.72 + (E < 0 ? Math.PI : 0),
              ne = 1 - Ie * 0.14;
            me(w, be, 0.23 * ne, 0.085 * ne, 0.19, Ie % 2 ? "leafLight" : "leaf", 0.78 + Ie * 0.045, !0);
          }
      }
      function kt(oe, y, I = 1, Be = 0) {
        for (let Se = 0; Se < 6; Se++) {
          const N = Se * 2.39996 + Be,
            Ie = (0.6 + (Se % 3) * 0.14) * I;
          let E = [oe, 0.026, y];
          for (let Y = 1; Y <= 4; Y++) {
            const w = Y / 4,
              be = [oe + Math.sin(N) * Ie * w, 0.032 + 0.019 * Math.sin(Y + Se), y + Math.cos(N) * Ie * w];
            Ge("green", E, be, 0.004 * I, 0.003 * I, 3);
            for (const ne of [-1, 1])
              me(be, N + ne * 1.16, 0.22 * I, 0.104 * I, 0.09, "ivy", 0.78 + (Y % 3) * 0.07, !0);
            E = be;
          }
        }
      }
      function M(oe, y, I, Be = "leaf", Se = 1) {
        const N = new t.Vector3(...oe),
          Ie = new t.Vector3(...y),
          E = new t.Vector3(Ie.z - N.z, 0, N.x - Ie.x).normalize().multiplyScalar(I),
          Y = N.clone().lerp(Ie, 0.46);
        Y.y += I * 0.45;
        const w = [
            ...N.toArray(),
            ...Y.clone().add(E).toArray(),
            ...Ie.toArray(),
            ...N.toArray(),
            ...Ie.toArray(),
            ...Y.clone().sub(E).toArray(),
          ],
          be = new t.BufferGeometry();
        (be.setAttribute("position", new t.Float32BufferAttribute(w, 3)),
          be.computeVertexNormals(),
          Fe(be, Be, [0, 0, 0], [1, 1, 1], [0, 0, 0], Se),
          be.dispose());
      }
      function ee(oe, y, I, Be, Se = 0) {
        Ge("green", [oe, 0.04, y], [oe, I, y], 0.009, 0.006, 4);
        for (const E of [-1, 1]) M([oe, I * 0.4, y], [oe + E * 0.16, I * 0.61, y + 0.025], 0.043, "leaf");
        const N = [];
        for (let E = 0; E < 5; E++) {
          const Y = (E * pe) / 5 + Se,
            w = Y + 0.34,
            be = 0.155;
          N.push(
            oe,
            I + 0.025,
            y,
            oe + Math.cos(Y) * be,
            I,
            y + Math.sin(Y) * be,
            oe + Math.cos(w) * be,
            I,
            y + Math.sin(w) * be,
          );
        }
        const Ie = new t.BufferGeometry();
        (Ie.setAttribute("position", new t.Float32BufferAttribute(N, 3)),
          Ie.computeVertexNormals(),
          Fe(Ie, Be),
          Ie.dispose(),
          pt("gold", [oe, I + 0.015, y], [0.033, 0.027, 0.033]));
      }
      switch (B) {
        case "bambou":
        case "foret-bambous": {
          const y = B === "foret-bambous",
            I = y ? 23 : 6,
            Be = y ? 3 : 0.6,
            Se = F * 1.27;
          for (let N = 0; N < I; N++) {
            const Ie = N * 2.39996 + Se,
              E = Math.sqrt((N + 0.5) / I) * Be,
              Y = Math.sin(Ie) * E,
              w = Math.cos(Ie) * E,
              be = (y ? 4.5 : 3.1) + 1.8 * (0.5 + 0.5 * Math.sin(N * 6.17 + Se)),
              ne = 0.12 + 0.21 * Math.sin(N * 3.7),
              K = Math.ceil(be / 0.42),
              fe = (Ee) => [Y + Math.sin(Ie) * ne * Ee, be * Ee, w + Math.cos(Ie) * ne * Ee];
            Ge("bamboo", fe(0), fe(1), y ? 0.065 : 0.048, 0.026, 6);
            for (let Ee = 1; Ee < K; Ee++) {
              const bt = Ee / K,
                mt = fe(bt);
              Ge(
                "bambooNode",
                [mt[0], mt[1] - 0.018, mt[2]],
                [mt[0], mt[1] + 0.022, mt[2]],
                0.061 - bt * 0.025,
                0.061 - bt * 0.025,
                6,
              );
            }
            for (let Ee = 0; Ee < 8; Ee++) {
              const bt = 0.32 + Ee * 0.09,
                mt = fe(bt),
                Ct = Ie + Ee * 2.4,
                Pt = 0.46 + (Ee % 3) * 0.18,
                jt = [mt[0] + Math.sin(Ct) * Pt, mt[1] + 0.18, mt[2] + Math.cos(Ct) * Pt];
              Ge("bamboo", mt, jt, 0.012, 0.004, 4);
              for (let Dt = 0; Dt < 7; Dt++) {
                const we = 0.14 + Dt * 0.13,
                  We = Dt % 2 ? 1 : -1,
                  yt = [mt[0] + (jt[0] - mt[0]) * we, mt[1] + 0.18 * we, mt[2] + (jt[2] - mt[2]) * we],
                  Ft = Ct + We * 0.9,
                  Bt = 0.39 + (Dt % 3) * 0.08;
                M(
                  yt,
                  [yt[0] + Math.sin(Ft) * Bt, yt[1] + 0.09 - (Dt % 2) * 0.15, yt[2] + Math.cos(Ft) * Bt],
                  0.048,
                  Dt % 3 ? "bambooLeaf" : "bambooTip",
                  0.84 + (Dt % 4) * 0.055,
                );
              }
            }
          }
          break;
        }
        case "carex": {
          const I = F * 0.81,
            Be = [];
          for (let N = 0; N < 46; N++) {
            const Ie = N * 2.39996 + I,
              E = 0.04 + (N % 4) * 0.025,
              Y = 0.54 + (N % 7) * 0.065,
              w = 0.42 + (N % 5) * 0.07,
              be = Math.sin(Ie),
              ne = Math.cos(Ie),
              K = ne,
              fe = -be,
              Ee = (bt) => [be * (E + Y * bt * bt), 0.02 + w * Math.sin(bt * Math.PI * 0.78), ne * (E + Y * bt * bt)];
            for (let bt = 0; bt < 6; bt++) {
              const mt = bt / 6,
                Ct = (bt + 1) / 6,
                Pt = Ee(mt),
                jt = Ee(Ct),
                Dt = 0.027 * (1 - mt) + 0.001,
                we = 0.027 * (1 - Ct) + 0.001;
              Be.push(
                Pt[0] - K * Dt,
                Pt[1],
                Pt[2] - fe * Dt,
                Pt[0] + K * Dt,
                Pt[1] + 0.007,
                Pt[2] + fe * Dt,
                jt[0] + K * we,
                jt[1],
                jt[2] + fe * we,
                Pt[0] - K * Dt,
                Pt[1],
                Pt[2] - fe * Dt,
                jt[0] + K * we,
                jt[1],
                jt[2] + fe * we,
                jt[0] - K * we,
                jt[1],
                jt[2] - fe * we,
              );
            }
          }
          const Se = new t.BufferGeometry();
          (Se.setAttribute("position", new t.Float32BufferAttribute(Be, 3)),
            Se.computeVertexNormals(),
            Fe(Se, "sedge"),
            Se.dispose());
          for (let N = 0; N < 5; N++) {
            const Ie = N * 2.4 + I,
              E = Math.sin(Ie) * 0.24,
              Y = Math.cos(Ie) * 0.24,
              w = 0.63 + (N % 3) * 0.09;
            (Ge("sedge", [0, 0.05, 0], [E, w, Y], 0.006, 0.003, 3),
              pt("bambooNode", [E, w, Y], [0.016, 0.067, 0.016], 0, 0.9));
          }
          break;
        }
        case "arbre-mort": {
          const y = F % 4,
            I = y * 0.67,
            Be = y === 3,
            Se = Be
              ? [
                  [0, 0, 0],
                  [0.08, 1.75, 0.02],
                  [0.15, 3.264, 0],
                ]
              : y === 1
                ? [
                    [0, 0, 0],
                    [0.09, 1.5, -0.06],
                    [-0.17, 3.12, 0.08],
                    [-0.67, 4.82, 0.08],
                  ]
                : y === 2
                  ? [
                      [0, 0, 0],
                      [0.09, 1.5, -0.06],
                      [0.37, 2.92, 0.08],
                      [0.7, 4.22, -0.1],
                    ]
                  : [
                      [0, 0, 0],
                      [0.09, 1.5, -0.06],
                      [-0.05, 3.12, 0.08],
                      [0.05, 4.82, 0.08],
                    ];
          for (let N = 1; N < Se.length; N++) Ge("deadTint", Se[N - 1], Se[N], 0.33 - N * 0.055, 0.3 - N * 0.06, 8);
          for (let N = 0; N < 6; N++) {
            const Ie = N * 2.39996 + I,
              E = 0.75 + (N % 3) * 0.11;
            Ge(
              "deadTint",
              [Math.sin(Ie) * 0.1, 0.27, Math.cos(Ie) * 0.1],
              [Math.sin(Ie) * E, 0.02, Math.cos(Ie) * E],
              0.12,
              0.025,
              5,
            );
          }
          if (
            (y === 1 &&
              (Ge("deadTint", [0.01, 2.16, 0], [0.67, 3.46, -0.1], 0.18, 0.12, 7),
              Ge("deadTint", [0.67, 3.46, -0.1], [1.04, 4.6, -0.21], 0.12, 0.055, 6)),
            Be)
          )
            for (let N = 0; N < 6; N++) {
              const Ie = N * 2.4,
                E = 1.12 + (N % 3) * 0.29;
              Ge("deadTint", [0, 2.208, 0], [Math.cos(Ie) * E, 3.9 + (N % 3) * 0.39, Math.sin(Ie) * E], 0.16, 0.095, 7);
            }
          else
            for (let N = 0; N < (y === 1 ? 5 : 7); N++) {
              const Ie = N * 2.39996 + I,
                E = (y === 2 ? 1.45 : 1.8) + (N % 4) * (y === 2 ? 0.42 : 0.59),
                Y = (y === 2 ? 1.75 : 1.22) + (N % 3) * 0.23,
                w = y === 2 ? 0.78 : 1.38,
                be = [Math.cos(Ie) * Y * 0.62, E + w * 0.46, Math.sin(Ie) * Y * 0.57],
                ne = [Math.cos(Ie) * Y, E + w + (N % 2) * 0.18, Math.sin(Ie) * Y];
              if (
                (Ge("deadTint", [0, E, 0], be, 0.13, 0.095, 6), Ge("deadTint", be, ne, 0.095, 0.035, 6), N % 2 === 0)
              ) {
                const K = [ne[0] + Math.cos(Ie + 0.9) * 0.36, ne[1] + 0.45, ne[2] + Math.sin(Ie + 0.9) * 0.36];
                Ge("deadTint", ne, K, 0.035, 0.012, 5);
              }
            }
          at([-0.4, 0, -0.4], [0.42, 3.28, 0.42]);
          break;
        }
        case "rocher":
        case "groupe-rochers": {
          const y = F * 17 + B.length,
            I = B === "rocher" ? 1 : 3;
          for (let Be = 0; Be < I; Be++) {
            const Se = new t.IcosahedronGeometry(1, 1),
              N = Se.attributes.position,
              Ie = B === "rocher" ? 1 : [0.88, 0.66, 0.55][Be],
              E = [
                [1.04, 0.75, 0.83],
                [0.69, 1.12, 0.77],
                [1.19, 0.47, 0.82],
                [0.84, 0.9, 1.03],
              ],
              Y = E[(F + Be) % 4],
              w = I === 1 ? 0 : [-0.53, 0.67, 0.25][Be],
              be = I === 1 ? 0 : [-0.13, 0.19, -0.7][Be];
            for (let K = 0; K < N.count; K++) {
              const fe = N.getX(K),
                Ee = N.getY(K),
                bt = N.getZ(K),
                mt = Math.sin(Math.round(fe * 87 + Ee * 51 + bt * 29) * 1.127 + y + Be * 43) * 0.12 + 1,
                Ct = Math.max(-0.11, Ee * Y[1] * mt + Y[1] * 0.73);
              N.setXYZ(K, w + fe * Y[0] * mt * Ie, Ct * Ie, be + bt * Y[2] * mt * Ie);
            }
            (Se.computeVertexNormals(),
              Fe(Se, "rockTint", [0, 0, 0], [1, 1, 1], [0, 0, 0], 0.9 + Be * 0.045),
              Se.computeBoundingBox());
            const ne = Se.boundingBox;
            (at([ne.min.x * 0.89, 0, ne.min.z * 0.89], [ne.max.x * 0.89, ne.max.y * 0.89, ne.max.z * 0.89]),
              Se.dispose());
          }
          break;
        }
        case "touffes-herbe":
          for (let y = 0; y < 5; y++) {
            const I = y * 2.39996,
              Be = Math.sin(I) * 0.3,
              Se = Math.cos(I) * 0.29;
            for (let N = 0; N < 7; N++) {
              const Ie = N * 2.39996 + y;
              M(
                [Be, 0.015, Se],
                [
                  Be + Math.sin(Ie) * (0.27 + (N % 3) * 0.075),
                  0.27 + (N % 4) * 0.093,
                  Se + Math.cos(Ie) * (0.28 + (N % 2) * 0.06),
                ],
                0.052 + (N % 3) * 0.017,
                N % 3 ? "leaf" : "leafLight",
                0.9 + (N % 3) * 0.06,
              );
            }
          }
          break;
        case "fleurs-sauvages":
          for (let y = 0; y < 13; y++) {
            const I = y * 2.39996,
              Be = Math.sqrt(y / 12) * 0.65,
              Se = Math.sin(I) * Be,
              N = Math.cos(I) * Be;
            (pt(y % 3 ? "leaf" : "leafLight", [Se, 0.13, N], [0.21, 0.13, 0.19], 0, 0.9 + (y % 3) * 0.06),
              ee(Se, N, 0.34 + (y % 5) * 0.09, ["cream", "cream", "rose", "yellow"][y % 4], y));
            for (let Ie = 0; Ie < 2; Ie++)
              M(
                [Se, 0, N],
                [Se + Math.sin(I + Ie) * 0.21, 0.27 + Ie * 0.08, N + Math.cos(I + Ie) * 0.2],
                0.026,
                "leafLight",
              );
          }
          break;
        case "hortensia": {
          let y = function (Y, w, be, ne, K, fe, Ee) {
            const bt = new t.Vector3(...Y),
              mt = new t.Vector3(Math.sin(w), K, Math.cos(w)),
              Ct = new t.Vector3(Math.cos(w), 0, -Math.sin(w)),
              Pt = [],
              jt = (we) =>
                bt
                  .clone()
                  .addScaledVector(mt, be * we)
                  .add(new t.Vector3(0, Math.sin(we * Math.PI) * 0.085, 0));
            for (let we = 0; we < 6; we++) {
              const We = we / 6,
                yt = (we + 1) / 6,
                Ft = jt(We),
                Bt = jt(yt),
                Rt = Math.sin(We * Math.PI) * ne * (we % 2 ? 0.91 : 1.05),
                qt = Math.sin(yt * Math.PI) * ne * ((we + 1) % 2 ? 0.91 : 1.05);
              for (const Kt of [-1, 1]) {
                const ro = Ft.clone().addScaledVector(Ct, Rt * Kt);
                ro.y -= Rt * 0.24;
                const oo = Bt.clone().addScaledVector(Ct, qt * Kt);
                ((oo.y -= qt * 0.24),
                  Pt.push(
                    ...Ft.toArray(),
                    ...ro.toArray(),
                    ...oo.toArray(),
                    ...Ft.toArray(),
                    ...oo.toArray(),
                    ...Bt.toArray(),
                  ));
              }
            }
            const Dt = new t.BufferGeometry();
            (Dt.setAttribute("position", new t.Float32BufferAttribute(Pt, 3)),
              Dt.computeVertexNormals(),
              Fe(Dt, fe, [0, 0, 0], [1, 1, 1], [0, 0, 0], Ee),
              Dt.dispose());
          };
          for (let Y = 0; Y < 7; Y++) {
            const w = Y * 2.39996,
              be = Math.sin(w) * 0.42,
              ne = Math.cos(w) * 0.4,
              K = 0.57 + (Y % 3) * 0.2;
            Ge("green", [0, 0.035, 0], [be, K, ne], 0.02, 0.009, 5);
            for (let fe = 0; fe < 3; fe++) {
              const Ee = w + (fe % 2 ? -0.68 : 0.74),
                bt = [be * (0.34 + fe * 0.23), 0.2 + fe * 0.17 + (Y % 2) * 0.07, ne * (0.34 + fe * 0.23)];
              y(
                bt,
                Ee,
                0.43 + (Y % 3) * 0.045,
                0.17 + (fe % 2) * 0.025,
                fe === 0 ? 0.17 : 0.25,
                (Y + fe) % 4 ? "leaf" : "leafLight",
                0.73 + (Y % 4) * 0.075 + fe * 0.035,
              );
            }
          }
          const I = [],
            Be = [];
          for (let Y = 0; Y < 6; Y++) {
            const w = Y * 2.39996,
              be = Y === 5 ? 0.08 : 0.46,
              ne = Math.sin(w) * be,
              K = Math.cos(w) * be,
              fe = 0.92 + (Y % 3) * 0.14,
              Ee = 0.265 + (Y % 2) * 0.035,
              bt = new t.Vector3(ne, fe, K);
            (Ge("green", [ne * 0.75, 0.4, K * 0.75], [ne, fe, K], 0.015, 0.009, 5),
              pt("rose", [ne, fe, K], [Ee * 0.79, Ee * 0.79, Ee * 0.79], 1, 0.7 + (Y % 3) * 0.06));
            for (let mt = 0; mt < 34; mt++) {
              const Ct = -0.42 + (1.42 * (mt + 0.5)) / 34,
                Pt = mt * 2.39996 + Y * 0.67,
                jt = Math.sqrt(1 - Ct * Ct),
                Dt = new t.Vector3(Math.cos(Pt) * jt, Ct, Math.sin(Pt) * jt),
                we = bt.clone().addScaledVector(Dt, Ee),
                We = new t.Vector3(0, 1, 0).cross(Dt).normalize(),
                yt = Dt.clone().cross(We).normalize(),
                Ft = 0.063 + (mt % 3) * 0.005;
              for (let qt = 0; qt < 4; qt++) {
                const Kt = qt * Math.PI * 0.5 + Y * 0.29,
                  ro = We.clone().multiplyScalar(Math.cos(Kt)).addScaledVector(yt, Math.sin(Kt)),
                  oo = We.clone().multiplyScalar(-Math.sin(Kt)).addScaledVector(yt, Math.cos(Kt)),
                  uo = we.clone().addScaledVector(Dt, 0.009),
                  Tt = we
                    .clone()
                    .addScaledVector(ro, Ft * 0.54)
                    .addScaledVector(oo, Ft * 0.4),
                  Jt = we.clone().addScaledVector(ro, Ft).addScaledVector(Dt, -0.018),
                  io = we
                    .clone()
                    .addScaledVector(ro, Ft * 0.54)
                    .addScaledVector(oo, -Ft * 0.4),
                  po = we
                    .clone()
                    .addScaledVector(ro, Ft * 0.55)
                    .addScaledVector(Dt, 0.012);
                I.push({
                  p: [
                    ...uo.toArray(),
                    ...Tt.toArray(),
                    ...po.toArray(),
                    ...Tt.toArray(),
                    ...Jt.toArray(),
                    ...po.toArray(),
                    ...Jt.toArray(),
                    ...io.toArray(),
                    ...po.toArray(),
                    ...io.toArray(),
                    ...uo.toArray(),
                    ...po.toArray(),
                  ],
                  shade: 0.82 + (mt % 5) * 0.065 + (Y % 2) * 0.025,
                });
              }
              const Bt = we.clone().addScaledVector(Dt, 0.018),
                Rt = 0.015;
              Be.push(
                ...Bt.clone().addScaledVector(We, -Rt).toArray(),
                ...Bt.clone().addScaledVector(yt, Rt).toArray(),
                ...Bt.clone().addScaledVector(We, Rt).toArray(),
              );
            }
          }
          const Se = [],
            N = [];
          for (const Y of I) {
            Se.push(...Y.p);
            for (let w = 0; w < Y.p.length; w++) N.push(Y.shade);
          }
          const Ie = new t.BufferGeometry();
          (Ie.setAttribute("position", new t.Float32BufferAttribute(Se, 3)),
            Ie.setAttribute("color", new t.Float32BufferAttribute(N, 3)),
            Ie.computeVertexNormals(),
            G.has("rose") || G.set("rose", []),
            G.get("rose").push(Ie));
          const E = new t.BufferGeometry();
          (E.setAttribute("position", new t.Float32BufferAttribute(Be, 3)),
            E.computeVertexNormals(),
            Fe(E, "cream"),
            E.dispose());
          break;
        }
        case "lierre-retombant":
          for (let y = 0; y < 5; y++) {
            const I = (y - 2) * 0.19,
              Be = 0.48 + (y % 3) * 0.21;
            let Se = [I, 0, 0];
            for (let N = 1; N <= 6; N++) {
              const Ie = [I + Math.sin(N * 1.4 + y) * 0.075, (-Be * N) / 6, 0.025 + Math.sin(N + y) * 0.025];
              Ge("green", Se, Ie, 0.008, 0.006, 4);
              for (const E of [-1, 1])
                M(Ie, [Ie[0] + E * 0.13, Ie[1] + 0.08, Ie[2] + 0.055], 0.078, "ivy", 0.92 + (N % 3) * 0.045);
              Se = Ie;
            }
          }
          break;
        case "mousse-rocher":
          for (let y = 0; y < 9; y++) {
            const I = y * 2.4,
              Be = Math.sqrt(y / 8) * 0.51;
            pt(
              y % 3 ? "leaf" : "leafLight",
              [Math.sin(I) * Be, 0.035, Math.cos(I) * Be],
              [0.3, 0.085, 0.28],
              0,
              0.82 + (y % 4) * 0.055,
            );
          }
          break;
        case "chaise":
          (ft(0.47, 0.46, 0.47),
            Le("wood", [0, 0.47, 0], [0.57, 0.055, 0.57]),
            Le("canvas", [0, 0.511, 0], [0.48, 0.035, 0.48]),
            Le("wood", [0, 0.74, 0.255], [0.55, 0.42, 0.055], [-0.08, 0, 0]),
            Le("canvas", [0, 0.745, 0.222], [0.43, 0.31, 0.025], [-0.08, 0, 0]),
            at([-0.31, 0, -0.31], [0.31, 0.98, 0.34]));
          break;
        case "transat":
          (ft(0.65, 1.4, 0.35),
            Le("wood", [0, 0.35, 0], [0.76, 0.075, 1.5]),
            Le("canvas", [0, 0.404, -0.15], [0.65, 0.04, 1.18]),
            Le("wood", [0, 0.67, 0.71], [0.76, 0.07, 0.94], [0.69, 0, 0]),
            Le("canvas", [0, 0.704, 0.69], [0.65, 0.022, 0.86], [0.69, 0, 0]),
            at([-0.41, 0, -0.78], [0.41, 1.02, 1.1]));
          break;
        case "table":
          ft(1.65, 0.75, 0.72, "wood", 0.09);
          for (let y = 0; y < 6; y++) Le("wood", [(y - 2.5) * 0.33, 0.745, 0], [0.315, 0.065, 1.02]);
          (Le("woodDark", [0, 0.25, 0], [1.72, 0.1, 0.07]), at([-1, 0, -0.52], [1, 0.79, 0.52]));
          break;
        case "banc":
          ft(1.6, 0.42, 0.46, "wood", 0.08);
          for (let y = -1; y <= 1; y++) Le("wood", [0, 0.48, y * 0.18], [1.96, 0.06, 0.165]);
          for (let y = 0; y < 3; y++) Le("wood", [0, 0.69 + y * 0.1, 0.28], [1.98, 0.082, 0.055]);
          for (const y of [-0.89, 0.89]) Le("woodDark", [y, 0.71, 0.3], [0.055, 0.47, 0.055]);
          at([-1.02, 0, -0.33], [1.02, 0.98, 0.35]);
          break;
        case "canape":
          (ft(2.13, 0.64, 0.24),
            Le("wood", [0, 0.28, 0], [2.36, 0.12, 0.9]),
            Le("coral", [0, 0.64, 0.36], [2.32, 0.55, 0.22]));
          for (const y of [-1.15, 1.15]) Le("coral", [y, 0.53, 0], [0.17, 0.41, 0.9]);
          for (const y of [-0.7, 0, 0.7])
            (Le("coral", [y, 0.4, -0.02], [0.67, 0.16, 0.7]),
              Le("coral", [y, 0.68, 0.24], [0.65, 0.4, 0.2], [-0.07, 0, 0], 1.07));
          at([-1.27, 0, -0.49], [1.27, 0.94, 0.51]);
          break;
        case "parasol":
          (Fe(S.cyl, "metal", [0, 0.06, 0], [0.42, 0.12, 0.42]), Ge("wood", [0, 0.09, 0], [0, 2.6, 0], 0.036));
          const oe = new t.ConeGeometry(1.72, 0.51, 10, 1, !0);
          (Fe(oe, "canvas", [0, 2.4, 0]), oe.dispose());
          for (let y = 0; y < 10; y++) {
            const I = (y * pe) / 10;
            Ge("wood", [0, 2.64, 0], [Math.sin(I) * 1.7, 2.145, Math.cos(I) * 1.7], 0.012);
          }
          (at([-0.42, 0, -0.42], [0.42, 0.15, 0.42]), at([-0.07, 0.15, -0.07], [0.07, 2.62, 0.07]));
          break;
        case "amphore": {
          const y = [
              [0.2, 0],
              [0.26, 0.04],
              [0.35, 0.17],
              [0.43, 0.42],
              [0.42, 0.65],
              [0.26, 0.82],
              [0.16, 0.88],
              [0.16, 1.02],
              [0.24, 1.06],
              [0.24, 1.12],
              [0.17, 1.12],
              [0.17, 1.04],
            ].map((Be) => new t.Vector2(...Be)),
            I = new t.LatheGeometry(y, 12);
          (Fe(I, "clay"), I.dispose());
          for (const Be of [-0.31, 0.31]) m("clay", [Be, 0.79, 0], 0.2, 0.035, [0, 0, 0]);
          (Fe(S.cyl, "soil", [0, 1.046, 0], [0.165, 0.02, 0.165]), at([-0.53, 0, -0.45], [0.53, 1.12, 0.45]));
          break;
        }
        case "pot-fleuri":
          Ve(0, 0, 1.08);
          for (let y = 0; y < 4; y++) {
            const I = y * 2.4;
            pt("leaf", [Math.sin(I) * 0.23, 0.67, Math.cos(I) * 0.23], [0.3, 0.18, 0.25]);
          }
          (ue(0, 0.83, 0, 1.1), at([-0.37, 0, -0.37], [0.37, 0.64, 0.37]));
          break;
        case "arche-fleurie": {
          for (const y of [-1.18, 1.18]) {
            (Ge("wood", [y, 0, -0.3], [y, 2.15, -0.3], 0.065), Ge("wood", [y, 0, 0.3], [y, 2.15, 0.3], 0.065));
            for (let I = 0; I < 4; I++) Ge("wood", [y, 0.45 + I * 0.43, -0.3], [y, 0.7 + I * 0.43, 0.3], 0.025);
            at([y - 0.13, 0, -0.39], [y + 0.13, 2.3, 0.39]);
          }
          for (const y of [-0.3, 0.3]) {
            let I = [1.18, 2.02, y];
            for (let Be = 1; Be <= 12; Be++) {
              const Se = (Be * Math.PI) / 12,
                N = [1.18 * Math.cos(Se), 2.02 + 0.79 * Math.sin(Se), y];
              (Ge("wood", I, N, 0.05), (I = N));
            }
          }
          for (let y = 0; y < 17; y++) {
            const I = (y * Math.PI) / 16,
              Be = Math.cos(I) * 1.18,
              Se = 2.03 + Math.sin(I) * 0.8;
            (pt(y % 3 ? "leaf" : "leafLight", [Be, Se, 0], [0.36, 0.31, 0.53], 1, 0.9 + (y % 3) * 0.055),
              y % 2 === 0 && ue(Be, Se + 0.03, -0.38, 0.65, y));
          }
          for (const y of [-1.18, 1.18])
            for (let I = 0; I < 4; I++)
              (pt("leaf", [y, 0.45 + I * 0.44, 0], [0.25, 0.35, 0.4], 0, 0.9),
                I % 2 && ue(y, 0.5 + I * 0.44, -0.32, 0.52, I));
          break;
        }
        case "tonnelle":
          for (const y of [-1.8, 1.8])
            for (const I of [-1.45, 1.45])
              (Le("wood", [y, 1.33, I], [0.13, 2.66, 0.13]), at([y - 0.1, 0, I - 0.1], [y + 0.1, 2.7, I + 0.1]));
          for (const y of [-1.45, 1.45]) Le("wood", [0, 2.6, y], [3.78, 0.15, 0.12]);
          for (const y of [-1.8, 1.8]) Le("wood", [y, 2.6, 0], [0.12, 0.15, 3]);
          {
            const y = [
                -1.95, 2.68, -1.61, 1.95, 2.68, -1.61, 0, 3.2, 0, 1.95, 2.68, -1.61, 1.95, 2.68, 1.61, 0, 3.2, 0, 1.95,
                2.68, 1.61, -1.95, 2.68, 1.61, 0, 3.2, 0, -1.95, 2.68, 1.61, -1.95, 2.68, -1.61, 0, 3.2, 0,
              ],
              I = new t.BufferGeometry();
            (I.setAttribute("position", new t.Float32BufferAttribute(y, 3)),
              I.computeVertexNormals(),
              Fe(I, "canvas"),
              I.dispose());
          }
          break;
        case "brasero": {
          const y = [
              [0.1, 0.31],
              [0.23, 0.31],
              [0.46, 0.39],
              [0.58, 0.57],
              [0.6, 0.61],
              [0.54, 0.64],
              [0.49, 0.49],
              [0.2, 0.39],
            ].map((Be) => new t.Vector2(...Be)),
            I = new t.LatheGeometry(y, 12);
          (Fe(I, "metal"), I.dispose());
          for (let Be = 0; Be < 3; Be++) {
            const Se = (Be * pe) / 3;
            Ge(
              "metal",
              [Math.cos(Se) * 0.38, 0.02, Math.sin(Se) * 0.38],
              [Math.cos(Se) * 0.25, 0.39, Math.sin(Se) * 0.25],
              0.034,
            );
          }
          for (let Be = 0; Be < 4; Be++) {
            const Se = Be * 1.4;
            Ge(
              "woodDark",
              [-Math.cos(Se) * 0.33, 0.46, -Math.sin(Se) * 0.33],
              [Math.cos(Se) * 0.33, 0.48, Math.sin(Se) * 0.33],
              0.066,
            );
          }
          for (let Be = 0; Be < 8; Be++)
            pt("ember", [Math.sin(Be * 2.4) * 0.27, 0.48, Math.cos(Be * 2.4) * 0.21], [0.06, 0.035, 0.055]);
          at([-0.6, 0, -0.6], [0.6, 0.66, 0.6]);
          break;
        }
        case "parasol-chauffant":
          (Fe(S.cyl, "metalLight", [0, 0.3, 0], [0.3, 0.6, 0.3]),
            Ge("metalLight", [0, 0.59, 0], [0, 1.76, 0], 0.054),
            Fe(S.cyl, "metal", [0, 1.88, 0], [0.17, 0.35, 0.17]),
            Fe(S.cyl, "ember", [0, 1.9, 0], [0.173, 0.2, 0.173]));
          for (let y = 0; y < 8; y++) {
            const I = (y * pe) / 8;
            Ge(
              "metal",
              [Math.sin(I) * 0.18, 1.73, Math.cos(I) * 0.18],
              [Math.sin(I) * 0.18, 2.04, Math.cos(I) * 0.18],
              0.014,
            );
          }
          (Fe(S.cone, "metalLight", [0, 2.22, 0], [0.62, 0.22, 0.62]), at([-0.32, 0, -0.32], [0.32, 2.1, 0.32]));
          break;
        case "bosquet":
          for (let y = 0; y < 5; y++) {
            const I = y * 2.4;
            se(Math.sin(I) * 0.68, Math.cos(I) * 0.62, 0.78 + (y % 3) * 0.22, y);
          }
          break;
        case "fougere":
          vt(0, 0, 1, 0.3);
          break;
        case "massif-fougeres":
          for (let y = 0; y < 9; y++) {
            const I = y * 2.39996,
              Be = Math.sqrt(y / 8) * 1.45;
            vt(Math.sin(I) * Be, Math.cos(I) * Be, 0.82 + (y % 3) * 0.16, y * 0.7);
          }
          break;
        case "grand-massif-fougeres":
          for (let y = 0; y < 24; y++) {
            const I = y * 2.39996,
              Be = Math.sqrt(y / 23) * 2.95;
            vt(Math.sin(I) * Be, Math.cos(I) * Be, 0.8 + (y % 4) * 0.13, y * 0.9);
          }
          break;
        case "fougeres-sauvages":
          for (let y = 0; y < 7; y++) {
            const I = y * 2.39996,
              Be = Math.sqrt(y / 6) * 0.89;
            vt(Math.sin(I) * Be, Math.cos(I) * Be, 1.32 + (y % 3) * 0.24, y * 0.61);
          }
          break;
        case "roncier":
          Re(0, 0, 1.25, 0.31, 9);
          break;
        case "lierre-sol":
          kt(0, 0, 1.4, 0.36);
          break;
        case "sous-bois-mixte":
          for (let y = 0; y < 4; y++) {
            const I = y * 2.39996,
              Be = 0.5 + (y % 2) * 0.7;
            vt(Math.sin(I) * Be, Math.cos(I) * Be, 1.18 + (y % 2) * 0.27, y * 0.6);
          }
          Re(0.34, -0.19, 1.1, 0.72, 5);
          for (let y = 0; y < 7; y++) {
            const I = y * 2.39996 + 0.8,
              Be = 0.36 + (y % 3) * 0.44;
            et(Math.sin(I) * Be, Math.cos(I) * Be, 0.52 + (y % 3) * 0.14, y * 1.2);
          }
          break;
        case "eucalyptus":
          (Ge("cut", [0, 0, 0], [0.08, 3.7, -0.08], 0.18, 0.092),
            Ge("cut", [0.08, 3.4, -0.08], [-0.15, 6.7, 0.06], 0.09, 0.021));
          for (let y = 0; y < 13; y++) {
            const I = y * 2.39996,
              Be = 2.8 + y * 0.28,
              Se = (1 - Math.abs(y - 6) / 12) * 2,
              N = Math.sin(I) * Se,
              Ie = Math.cos(I) * Se;
            Ge("cut", [0, Be - 0.55, 0], [N, Be + 0.8, Ie], 0.05, 0.016);
            for (let E = 0; E < 3; E++) {
              const Y = [N + Math.sin(I + E * 2) * 0.4, Be + 0.85 + E * 0.27, Ie + Math.cos(I + E * 2) * 0.36];
              pt("euca", Y, [0.56, 0.26, 0.46], 1, 0.87 + (y % 4) * 0.045);
            }
          }
          (pt("euca", [-0.15, 7.1, 0.05], [0.68, 0.55, 0.63], 1), at([-0.2, 0, -0.2], [0.2, 3.5, 0.2]));
          break;
        case "fleurs":
          for (let y = 0; y < 7; y++) {
            const I = y * 2.4,
              Be = Math.sqrt(y / 6) * 0.8;
            (pt("leaf", [Math.sin(I) * Be, 0.2, Math.cos(I) * Be], [0.41, 0.23, 0.37], 0, 0.9 + (y % 2) * 0.1),
              ue(Math.sin(I) * Be, 0.4, Math.cos(I) * Be, 0.77, y));
          }
          break;
        case "tronc-mort":
          (Ge("bark", [-1.52, 0.29, 0.04], [1.35, 0.25, -0.06], 0.3, 0.21, 9),
            Ge("cut", [-1.529, 0.29, 0.04], [-1.539, 0.29, 0.04], 0.258, 0.258, 9),
            Ge("cut", [1.355, 0.25, -0.06], [1.365, 0.25, -0.06], 0.181, 0.181, 9),
            Ge("bark", [0.18, 0.3, 0], [0.35, 0.68, 0.5], 0.11, 0.045),
            Ge("bark", [-0.62, 0.31, 0], [-0.72, 0.58, -0.38], 0.105, 0.04),
            at([-1.55, 0, -0.35], [1.38, 0.61, 0.38]));
          break;
        case "souche":
          (Ge("bark", [0, 0, 0], [0.07, 0.64, 0], 0.43, 0.34, 9),
            Ge("cut", [0.07, 0.642, 0], [0.07, 0.656, 0], 0.294, 0.294, 9));
          for (let y = 0; y < 5; y++) {
            const I = (y * pe) / 5;
            Ge("bark", [0, 0.13, 0], [Math.sin(I) * 0.61, 0.03, Math.cos(I) * 0.61], 0.12, 0.04);
          }
          at([-0.48, 0, -0.48], [0.48, 0.69, 0.48]);
          break;
        case "ballon":
        case "ballons": {
          const y = B === "ballon" ? 1 : 3;
          for (let I = 0; I < y; I++) {
            const Be = y === 1 ? 0 : Math.sin(I * 2.4) * 0.48,
              Se = y === 1 ? 0 : Math.cos(I * 2.4) * 0.3,
              N = y === 1 ? 1.52 : 1.85 + (I % 2) * 0.28;
            (Fe(S.sphere, ["coral", "canvas", "blue"][I], [Be, N, Se], [0.3, 0.42, 0.3]),
              Ge("canvas", [0, 0.06, 0], [Be, N - 0.42, Se], 0.007, 0.007, 4),
              Fe(S.cone, ["coral", "canvas", "blue"][I], [Be, N - 0.43, Se], [0.035, 0.07, 0.035], [Math.PI, 0, 0]));
          }
          Ge("woodDark", [0, 0, 0], [0, 0.16, 0], 0.015);
          break;
        }
        case "quad": {
          // V32 : meme quad olive que celui que l'on conduit (voir MoulinPlayer22).
          const Q = Math.PI / 2;
          (Le("metal", [0, 0.36, 0], [0.62, 0.1, 1.5]),
            Le("quadDark", [0, 0.52, 0.04], [0.46, 0.3, 0.6]),
            Fe(S.sphere, "quad", [0, 0.8, 0.32], [0.29, 0.16, 0.38]),
            Fe(S.sphere, "quadSeat", [0, 0.9, -0.3], [0.2, 0.075, 0.44]),
            Le("quadSeat", [0, 0.86, -0.31], [0.36, 0.08, 0.66]),
            Le("quad", [0, 0.74, 0.66], [1.16, 0.1, 0.68], [0.06, 0, 0]),
            Le("quad", [0, 0.64, 1.0], [1.02, 0.2, 0.08], [-0.55, 0, 0]),
            Le("quad", [0, 0.76, -0.66], [1.16, 0.1, 0.64], [-0.05, 0, 0]),
            Le("quad", [0, 0.67, -0.99], [1.02, 0.17, 0.08], [0.5, 0, 0]));
          for (const y of [-0.64, 0.64])
            for (const I of [-1, 1])
              (Le("quad", [I * 0.66, 0.735, y], [0.37, 0.07, 0.44]),
                Le("quad", [I * 0.66, 0.655, y + 0.29], [0.37, 0.06, 0.22], [-0.75, 0, 0]),
                Le("quad", [I * 0.66, 0.655, y - 0.29], [0.37, 0.06, 0.22], [0.75, 0, 0]),
                Fe(S.cyl, "tyre", [I * 0.68, 0.33, y], [0.31, 0.27, 0.31], [0, 0, Q]),
                Fe(S.cyl, "quadChrome", [I * 0.684, 0.33, y], [0.19, 0.282, 0.19], [0, 0, Q]),
                Fe(S.cyl, "metal", [I * 0.68, 0.33, y], [0.075, 0.292, 0.075], [0, 0, Q]));
          for (const y of [-0.64, 0.64])
            for (const I of [-1, 1])
              for (let Be = 0; Be < 16; Be++) {
                const Se = (Be / 16) * pe;
                Le("tyre", [I * 0.68 + (Be % 2 ? 0.065 : -0.065), 0.33 + Math.cos(Se) * 0.318, y + Math.sin(Se) * 0.318], [0.125, 0.05, 0.075], [Se, 0, 0]);
              }
          for (const y of [-1, 1])
            (Le("quadDark", [y * 0.36, 0.63, 0], [0.1, 0.2, 0.64]),
              Le("quadDark", [y * 0.46, 0.42, -0.03], [0.24, 0.04, 0.48]),
              Ge("quadChrome", [y * 0.34, 0.48, 1.06], [y * 0.34, 0.74, 1.06], 0.028),
              Fe(S.cyl, "quadLamp", [y * 0.27, 0.76, 0.99], [0.075, 0.05, 0.075], [Q, 0, 0]),
              Le("quadRed", [y * 0.34, 0.68, -1.01], [0.15, 0.06, 0.03]));
          for (const [y, I] of [
            [0.72, 0.5],
            [-0.73, 0.56],
          ]) {
            for (const Be of [-1, 1]) Ge("quadChrome", [Be * 0.44, 0.87, y - I / 2], [Be * 0.44, 0.87, y + I / 2], 0.022);
            for (const Be of [-I / 2, 0, I / 2]) Ge("quadChrome", [-0.45, 0.87, y + Be], [0.45, 0.87, y + Be], 0.022);
          }
          (Ge("quadChrome", [-0.36, 0.5, 1.07], [0.36, 0.5, 1.07], 0.03),
            Ge("quadChrome", [-0.31, 0.72, 1.06], [0.31, 0.72, 1.06], 0.026),
            Ge("quadChrome", [0, 0.86, 0.39], [0, 1.15, 0.47], 0.026),
            Ge("metal", [-0.42, 1.153, 0.47], [0.42, 1.153, 0.47], 0.022),
            Ge("quadDark", [-0.44, 1.153, 0.47], [-0.3, 1.153, 0.47], 0.036),
            Ge("quadDark", [0.3, 1.153, 0.47], [0.44, 1.153, 0.47], 0.036),
            Ge("metal", [0.3, 0.5, -0.8], [0.3, 0.6, -1.1], 0.045),
            at([-0.83, 0, -1.1], [0.83, 1.28, 1.1]));
          break;
        }
      }
      const ge = [];
      for (const [oe, y] of G) {
        const I = y.reduce((Y, w) => Y + w.attributes.position.count, 0),
          Be = new Float32Array(I * 3),
          Se = new Float32Array(I * 3),
          N = new Float32Array(I * 3);
        let Ie = 0;
        for (const Y of y)
          (Be.set(Y.attributes.position.array, Ie),
            Se.set(Y.attributes.normal.array, Ie),
            N.set(Y.attributes.color.array, Ie),
            (Ie += Y.attributes.position.array.length),
            Y.dispose());
        const E = new t.BufferGeometry();
        (E.setAttribute("position", new t.BufferAttribute(Be, 3)),
          E.setAttribute("normal", new t.BufferAttribute(Se, 3)),
          E.setAttribute("color", new t.BufferAttribute(N, 3)),
          E.computeBoundingBox(),
          E.computeBoundingSphere(),
          (_e[oe].vertexColors = !0),
          oe === "canvas" && (_e[oe].side = t.DoubleSide),
          ge.push({ geometry: E, material: _e[oe], key: oe }));
      }
      const ae = new t.Box3();
      ge.forEach((oe) => ae.union(oe.geometry.boundingBox));
      const de = { parts: ge, colliders: Qe, bounds: ae };
      return (te.set(g, de), de);
    }
    function je(B, F) {
      const g = (n.ground || n.terrainHeight)(B, F);
      return Number.isFinite(g) ? g : 0;
    }
    function lt(B, F) {
      const g = z.has(B.type) ? B.type : F == null ? void 0 : F.type;
      if (!g) return null;
      const G = Number(B.x ?? (F == null ? void 0 : F.x)),
        Qe = Number(B.z ?? (F == null ? void 0 : F.z));
      if (!Number.isFinite(G) || !Number.isFinite(Qe)) return null;
      const Fe = (Ge, m, at, ft) => {
          const ue = Number(B[Ge] ?? (F == null ? void 0 : F[Ge]) ?? m);
          return Math.max(at, Math.min(ft, Number.isFinite(ue) ? ue : m));
        },
        Le = {
          id: (F == null ? void 0 : F.id) || (/^objet-\d+$/.test(B.id || "") ? B.id : "objet-" + ++le),
          type: g,
          x: G,
          z: Qe,
          yOffset: Fe("yOffset", 0, -20, 30),
          rotation: Fe("rotation", 0, -1e5, 1e5),
          scale: Fe("scale", z.get(g).defaultScale, 0.1, 10),
          variant: Math.floor(Fe("variant", 0, 0, 3)),
        },
        pt = B.color === null || B.color === "" ? null : (B.color ?? (F == null ? void 0 : F.color));
      return (typeof pt == "string" && /^#[0-9a-f]{6}$/i.test(pt) && (Le.color = pt.toLowerCase()), Le);
    }
    function Ke(B) {
      return (
        b.set(B.x, je(B.x, B.z) + B.yOffset, B.z),
        h.setFromAxisAngle(q, B.rotation),
        p.setScalar(B.scale),
        k.compose(b, h, p)
      );
    }
    function ve() {
      var B, F;
      ((X = null), (B = n.markDirty) == null || B.call(n), (F = n.invalidate) == null || F.call(n));
    }
    function qe(B) {
      var g;
      const F = O.get(B);
      if (F) {
        for (const G of F.meshes) (A.remove(G), G.geometry.dispose(), (g = G.dispose) == null || g.call(G));
        O.delete(B);
      }
    }
    function Xe(B) {
      var G;
      const F = new t.Box3(),
        g = Me(B.list[0].type, B.list[0].variant).bounds;
      for (let Qe = 0; Qe < B.list.length; Qe++) {
        const Fe = B.list[Qe],
          Le = Ke(Fe);
        (T.has(Fe.id) && Le.makeScale(0, 0, 0), F.union(g.clone().applyMatrix4(Le)));
        for (const pt of B.meshes) {
          pt.setMatrixAt(Qe, Le);
          const Ge = z.get(Fe.type),
            m = re.has(Fe.type) || Ge.tintKeys ? 1 : [1, 0.93, 1.06, 0.97][Fe.variant],
            at =
              Fe.color ||
              ((G = Ge.variantColors) == null ? void 0 : G[Fe.variant]) ||
              (re.has(Fe.type) ? Ge.defaultColor : null);
          if (Ge.colorable && at && (!Ge.tintKeys || Ge.tintKeys.includes(pt.userData.propPart))) {
            const ft = n.rgb ? n.rgb(at) : new t.Color(at).convertSRGBToLinear(),
              ue = pt.material.color;
            pt.setColorAt(
              Qe,
              new t.Color(
                ft.r / Math.max(1e-4, ue.r),
                ft.g / Math.max(1e-4, ue.g),
                ft.b / Math.max(1e-4, ue.b),
              ).multiplyScalar(m),
            );
          } else pt.setColorAt(Qe, new t.Color(m, m, m));
        }
      }
      for (const Qe of B.meshes)
        ((Qe.geometry.boundingBox = F.clone()),
          (Qe.geometry.boundingSphere = F.getBoundingSphere(new t.Sphere())),
          (Qe.instanceMatrix.needsUpdate = !0),
          Qe.instanceColor && (Qe.instanceColor.needsUpdate = !0));
      A.updateMatrixWorld(!0);
    }
    function _t(B) {
      return V(B.type, B.variant) + "|" + Math.floor(B.x / 40) + ":" + Math.floor(B.z / 40);
    }
    function Mt(B) {
      for (const [g, G] of [...O]) G.list[0].type === B && qe(g);
      const F = new Map();
      for (const g of R) {
        if (g.type !== B) continue;
        const G = _t(g);
        (F.has(G) || F.set(G, []), F.get(G).push(g));
      }
      for (const [g, G] of F) {
        const Qe = Me(B, G[0].variant).parts.map((Le, pt) => {
            const Ge = new t.BufferGeometry();
            Ge.index = Le.geometry.index;
            for (const at of Object.keys(Le.geometry.attributes)) Ge.setAttribute(at, Le.geometry.attributes[at]);
            const m = new t.InstancedMesh(Ge, Le.material, G.length);
            return (
              (m.name = "Objets_" + B + "_" + Le.key),
              m.instanceMatrix.setUsage(t.DynamicDrawUsage),
              (m.frustumCulled = !0),
              (m.castShadow = ![
                "ballon",
                "ballons",
                "fougere",
                "massif-fougeres",
                "grand-massif-fougeres",
                "fleurs",
                "carex",
                ...ce,
              ].includes(B)),
              (m.receiveShadow = !0),
              (m.userData.propPart = Le.key),
              (m.userData.propIds = G.map((at) => at.id)),
              A.add(m),
              m
            );
          }),
          Fe = { list: G, meshes: Qe };
        (O.set(g, Fe), Xe(Fe));
      }
    }
    function st(B) {
      const F = lt(B);
      return F
        ? (he.has(F.id) && (F.id = "objet-" + ++le),
          (le = Math.max(le, Number(F.id.slice(6)))),
          R.push(F),
          he.set(F.id, F),
          Mt(F.type),
          ve(),
          F)
        : null;
    }
    function $(B, F) {
      const g = he.get(B);
      if (!g) return null;
      const G = lt(F, g);
      if (!G) return null;
      const Qe = g.type,
        Fe = _t(g);
      return (
        Object.assign(g, G),
        (F.color === null ||
          F.color === "" ||
          (F.variant !== void 0 && z.get(G.type).variantColors && F.color === void 0)) &&
          delete g.color,
        Qe !== G.type || Fe !== _t(G) ? (Mt(Qe), Qe !== G.type && Mt(G.type)) : Xe(O.get(_t(G))),
        ve(),
        g
      );
    }
    function U(B) {
      const F = he.get(B);
      return F ? (R.splice(R.indexOf(F), 1), he.delete(B), T.delete(B), Mt(F.type), ve(), !0) : !1;
    }
    function He(B) {
      for (const F of [...O.keys()]) qe(F);
      ((R.length = 0), he.clear(), T.clear(), (le = 0));
      for (const F of Array.isArray(B) ? B : []) {
        const g = lt(F);
        g &&
          (he.has(g.id) && (g.id = "objet-" + ++le),
          (le = Math.max(le, Number(g.id.slice(6)))),
          R.push(g),
          he.set(g.id, g));
      }
      for (const F of new Set(R.map((g) => g.type))) Mt(F);
      return (ve(), R);
    }
    function Ce() {
      for (const B of O.values()) Xe(B);
      ve();
    }
    function xe() {
      if (X) return X;
      X = [];
      for (const B of R) {
        if (T.has(B.id)) continue;
        const F = Me(B.type, B.variant),
          g = Ke(B);
        for (const G of F.colliders) X.push(G.clone().applyMatrix4(g));
      }
      return X;
    }
    function H(B) {
      let F = null;
      const g = new t.Mesh(),
        G = new t.Sphere(),
        Qe = new t.Matrix4();
      A.updateMatrixWorld(!0);
      for (const Fe of R) {
        if (T.has(Fe.id)) continue;
        const Le = Me(Fe.type, Fe.variant);
        if (
          (Qe.multiplyMatrices(A.matrixWorld, Ke(Fe)),
          Le.bounds.getBoundingSphere(G),
          G.applyMatrix4(Qe),
          !!B.ray.intersectsSphere(G))
        ) {
          g.matrixWorld.copy(Qe);
          for (const pt of Le.parts) {
            ((g.geometry = pt.geometry), (g.material = pt.material));
            const Ge = [];
            g.raycast(B, Ge);
            for (const m of Ge)
              (!F || m.distance < F.distance) && (F = { id: Fe.id, point: m.point, distance: m.distance });
          }
        }
      }
      return F;
    }
    function W(B) {
      if (!z.has(B)) return null;
      const F = new t.Group();
      ((F.name = "Apercu_placement_" + B), (F.userData.editorHelper = !0), (F.userData.exportSkip = !0));
      const g = new t.MeshBasicMaterial({
        color: 9687984,
        transparent: !0,
        opacity: 0.38,
        depthWrite: !1,
        side: t.DoubleSide,
      });
      for (const G of Me(B).parts) {
        const Qe = new t.Mesh(G.geometry, g);
        ((Qe.renderOrder = 5), F.add(Qe));
      }
      return ((F.userData.dispose = () => g.dispose()), F);
    }
    function D(B, F, g) {
      var Qe;
      if (!z.has(B) || !((Qe = g == null ? void 0 : g.parts) != null && Qe.length))
        throw Error("Mod\xE8le de catalogue invalide.");
      const G = new t.Box3();
      for (const Fe of g.parts)
        (Fe.geometry.computeBoundingBox(), Fe.geometry.computeBoundingSphere(), G.union(Fe.geometry.boundingBox));
      return (
        te.set(V(B, F), { parts: g.parts, colliders: g.colliders || [], bounds: G }),
        R.some((Fe) => Fe.type === B) && Mt(B),
        ve(),
        !0
      );
    }
    function De(B, F) {
      const g = he.get(B);
      return g ? (F ? T.add(B) : T.delete(B), Xe(O.get(_t(g))), ve(), !0) : !1;
    }
    function ke(B) {
      if (!z.has(B)) return null;
      const F = new t.Group();
      F.name = B;
      for (const g of Me(B).parts) {
        const G = new t.Mesh(g.geometry, g.material);
        ((G.name = g.key), (G.castShadow = !0), (G.receiveShadow = !0), F.add(G));
      }
      return F;
    }
    function rt() {
      var F;
      const B = new t.Group();
      B.name = A.name;
      for (const g of R) {
        const G = new t.Group();
        ((G.name = g.id), Ke(g).decompose(G.position, G.quaternion, G.scale));
        for (const Qe of Me(g.type, g.variant).parts) {
          const Fe = Qe.material.clone(),
            Le = z.get(g.type),
            pt =
              g.color ||
              ((F = Le.variantColors) == null ? void 0 : F[g.variant]) ||
              (re.has(g.type) ? Le.defaultColor : null);
          (Le.colorable &&
            pt &&
            (!Le.tintKeys || Le.tintKeys.includes(Qe.key)) &&
            Fe.color.copy(n.rgb ? n.rgb(pt) : new t.Color(pt).convertSRGBToLinear()),
            Fe.color.multiplyScalar(re.has(g.type) || Le.tintKeys ? 1 : [1, 0.93, 1.06, 0.97][g.variant]),
            G.add(new t.Mesh(Qe.geometry, Fe)));
        }
        B.add(G);
      }
      return B;
    }
    const $e = {
      catalog: C,
      records: R,
      group: A,
      add: st,
      update: $,
      remove: U,
      replace: He,
      get: (B) => he.get(B) || null,
      exportRecords: () => R.map((B) => Object.assign({}, B)),
      pick: H,
      resettle: Ce,
      collisionBoxes: xe,
      createPreview: W,
      createModel: ke,
      setHidden: De,
      registerTemplate: D,
      exportGroup: rt,
      get stats() {
        return {
          count: R.length,
          tiles: O.size,
          drawCalls: [...O.values()].reduce((B, F) => B + F.meshes.length, 0),
          triangles: [...O.values()].reduce(
            (B, F) =>
              B +
              F.meshes.reduce(
                (g, G) =>
                  g +
                  ((G.geometry.index ? G.geometry.index.count : G.geometry.attributes.position.count) / 3) * G.count,
                0,
              ),
            0,
          ),
        };
      },
    };
    return ((A.moulinProps = $e), $e);
  }),
  (globalThis.MoulinTerrainTools21 = function (t, n) {
    "use strict";
    const { pos: A, base: re, values: R, terrainData: he, terrainHeight: te, terrainAllowed: O, vertexBuckets: T } = n,
      le = (V, Me, je) => Math.max(Me, Math.min(je, V)),
      X = (V, Me) => (Number.isFinite(V) ? V : Me),
      a = (V) => ((V = le(V, 0, 1)), V * V * (3 - 2 * V)),
      _e = he.constraints || [],
      pe = new Map(),
      q = new Set(),
      v = new Map();
    let k = null;
    for (const V of _e) {
      q.add(V[0]);
      for (const Me of [V[1], V[2]]) (pe.has(Me) || pe.set(Me, []), pe.get(Me).push(V));
    }
    function h(V) {
      return (v.has(V) || v.set(V, O(re[V * 3], re[V * 3 + 2]) !== !1), v.get(V));
    }
    function b(V, Me = new Set()) {
      if (Me.has(V)) return !0;
      if ((Me.add(V), !h(V))) return !1;
      for (const [je] of pe.get(V) || []) if (!b(je, Me)) return !1;
      return !0;
    }
    function p(V) {
      const Me = V.origin || V,
        je = X(Me.x, X(V.x, 0)),
        lt = X(Me.z, X(V.z, 0));
      return { x: je, z: lt, height: X(Me.height, X(Me.y, X(V.targetHeight, te(je, lt)))) };
    }
    function S(V = {}) {
      return ((k = { origin: p(V), initial: new Map(), mode: V.mode || null }), { ...k.origin });
    }
    function x() {
      k = null;
    }
    function c(V, Me) {
      return V >= 1 ? 0 : Me <= 1e-5 ? 1 : 1 - a((V - (1 - Me)) / Me);
    }
    function P(V, Me, je, lt) {
      const Ke = [];
      for (let ve = Math.floor(Me / 8); ve <= Math.floor(lt / 8); ve++)
        for (let qe = Math.floor(V / 8); qe <= Math.floor(je / 8); qe++) {
          const Xe = T.get(qe + "," + ve);
          if (Xe) for (const _t of Xe) Ke.push(_t);
        }
      return Ke;
    }
    function C(V, Me, je) {
      const lt = je * 0.70710678118;
      return (
        (te(V - je, Me) +
          te(V + je, Me) +
          te(V, Me - je) +
          te(V, Me + je) +
          te(V - lt, Me - lt) +
          te(V + lt, Me - lt) +
          te(V - lt, Me + lt) +
          te(V + lt, Me + lt)) /
        8
      );
    }
    function Ne(V = {}) {
      const Me = V.mode || "raise";
      if (!["raise", "lower", "flatten", "smooth", "restore", "ramp", "terrace"].includes(Me))
        return { changed: !1, count: 0 };
      const je = le(X(V.strength, 1), 0, 12),
        lt = le(X(V.dt, 1 / 30), 0, 1);
      if (!je || !lt) return { changed: !1, count: 0 };
      const Ke = Me === "ramp" || Me === "terrace";
      Ke && !k && S(V);
      const ve = Ke ? k.origin : p(V),
        qe = Ke ? ve.x : X(V.x, 0),
        Xe = Ke ? ve.z : X(V.z, 0),
        _t = le(X(V.radius, 4), 0.5, 80),
        Mt = le(X(V.falloff, 0.45), 0, 1),
        st = le(X(V.width, _t * 2), 1, 100),
        $ = le(X(V.length, _t * 2), 1, 100),
        U = (X(V.angle, 0) * Math.PI) / 180,
        He = Math.cos(U),
        Ce = Math.sin(U),
        xe = Ke ? Math.abs(He) * $ * 0.5 + Math.abs(Ce) * st * 0.5 : _t,
        H = Ke ? Math.abs(Ce) * $ * 0.5 + Math.abs(He) * st * 0.5 : _t,
        W = X(V.targetHeight, ve.height),
        D = le(X(V.delta, 2), -12, 12),
        De = V.oneSided !== !1,
        ke = le(je * lt * 4, 0, 1),
        rt = [],
        $e = P(qe - xe, Xe - H, qe + xe, Xe + H);
      let B = 0;
      for (const Le of $e) {
        const pt = re[Le * 3],
          Ge = re[Le * 3 + 2],
          m = pt - qe,
          at = Ge - Xe,
          ft = m * He + at * Ce,
          ue = -m * Ce + at * He,
          se = Ke ? c(Math.abs(ft) / ($ * 0.5), Mt) * c(Math.abs(ue) / (st * 0.5), Mt) : c(Math.hypot(m, at) / _t, Mt);
        if (se < 1e-6 || q.has(Le)) continue;
        if (!b(Le)) {
          B++;
          continue;
        }
        const Ve = R[Le * 3 + 1],
          vt = re[Le * 3 + 1];
        let me = Ve;
        if (Me === "raise" || Me === "lower") me = Ve + (Me === "raise" ? 1 : -1) * je * lt * se;
        else if (Me === "flatten") me = Ve + (W - Ve) * ke * se;
        else if (Me === "restore") me = Ve + (vt - Ve) * ke * se;
        else if (Me === "smooth") me = Ve + (C(pt, Ge, Math.max(0.35, Math.min(3, _t * 0.2))) - Ve) * ke * se;
        else {
          k.initial.has(Le) || k.initial.set(Le, Ve);
          const Re = k.initial.get(Le),
            et = $ * 0.5,
            kt = Math.max(0.25, et * (1 - Mt)),
            M = a(De ? Math.max(0, ft) / kt : (ft + kt) / (kt * 2)),
            ee = Me === "terrace" ? W : W + D * M,
            ge = Re + (ee - Re) * se;
          me = Ve + (ge - Ve) * ke;
        }
        ((me = le(me, vt - 12, vt + 12)), Math.abs(me - Ve) > 1e-6 && rt.push([Le, me]));
      }
      const F = new Map(rt),
        g = rt.map((Le) => Le[0]),
        G = (Le) => (F.has(Le) ? F.get(Le) : R[Le * 3 + 1]);
      for (let Le = 0; Le < g.length; Le++)
        for (const [pt, Ge, m, at] of pe.get(g[Le]) || []) {
          const ft = G(Ge) * (1 - at) + G(m) * at;
          Math.abs(ft - G(pt)) > 1e-6 && (F.set(pt, ft), g.push(pt));
        }
      const Qe = [...F].map(([Le, pt]) => [Le, pt, R[Le * 3 + 1]]),
        Fe = new Proxy(R, {
          get(Le, pt) {
            const Ge = typeof pt == "string" ? Number(pt) : NaN;
            return Number.isInteger(Ge) && Ge % 3 === 1 && F.has((Ge - 1) / 3)
              ? F.get((Ge - 1) / 3)
              : Reflect.get(Le, pt);
          },
        });
      return {
        changed: Qe.length > 0,
        count: Qe.length,
        changes: Qe,
        visited: $e.length,
        protectedSkipped: B,
        bounds: { x0: qe - xe, x1: qe + xe, z0: Xe - H, z1: Xe + H },
        options: { ...V, x: qe, z: Xe, width: st, length: $, radius: _t, angle: X(V.angle, 0), targetHeight: W },
        source: Fe,
        heightAt: (Le, pt) => te(Le, pt, Fe),
      };
    }
    function z(V) {
      var Me, je;
      if (!((Me = V == null ? void 0 : V.changes) != null && Me.length))
        return { changed: !1, count: 0, changes: [], indices: [] };
      for (const [lt, Ke, ve] of V.changes) {
        if (
          !Number.isInteger(lt) ||
          lt < 0 ||
          lt >= A.count ||
          !Number.isFinite(Ke) ||
          Math.abs(Ke - re[lt * 3 + 1]) > 12.00002
        )
          throw Error("Aper\xE7u du relief invalide.");
        if (Math.abs(R[lt * 3 + 1] - ve) > 1e-5)
          throw Error("Le terrain a chang\xE9. Replacez l\u2019aper\xE7u avant d\u2019appliquer.");
      }
      for (const [lt, Ke] of V.changes) R[lt * 3 + 1] = A.array[lt * 3 + 1] = Ke;
      return (
        (A.needsUpdate = !0),
        (je = n.markDirty) == null || je.call(n),
        {
          changed: !0,
          count: V.changes.length,
          changes: V.changes,
          indices: V.changes.map((lt) => lt[0]),
          protectedSkipped: V.protectedSkipped,
        }
      );
    }
    function ce(V = {}) {
      return z(Ne(V));
    }
    return {
      apply: ce,
      plan: Ne,
      applyPlan: z,
      beginStroke: S,
      endStroke: x,
      clearProtectionCache() {
        v.clear();
      },
      get activeOrigin() {
        return k ? { ...k.origin } : null;
      },
    };
  }),
  (globalThis.MoulinPlayer22 = function (t, n) {
    "use strict";
    const {
        root: A,
        mount: re,
        model: R,
        camera: he,
        controls: te,
        renderer: O,
        terrainHeight: T,
        cameraSupportHeight: le,
        bounds: X,
      } = n,
      a = O.domElement,
      _e = t.MathUtils.clamp,
      pe = Math.PI,
      q = (f, J, Ze, Je) => f + (J - f) * (1 - Math.exp(-Ze * Je)),
      v = new t.Group();
    ((v.name = "Promeneur_sweat_bordeaux"), (v.userData.exportSkip = !0), (v.visible = !1), R.add(v));
    const k = new t.Group();
    ((k.name = "Garcon_chignon_brun"), v.add(k));
    const h = {
        wine: "#7c3849",
        wineDark: "#532733",
        rib: "#663342",
        skin: "#d6a37c",
        skinLight: "#dfb390",
        hair: "#463126",
        hairLight: "#5f4432",
        black: "#252c2d",
        sole: "#d6d4c6",
        eye: "#2c2925",
        cord: "#c5b8a1",
        olive: "#5b6b30",
        metal: "#3f4843",
        silver: "#aab2ab",
        tyre: "#2b302f",
        lamp: "#f2f6e8",
        red: "#b3322c",
        quadDark: "#262b2c",
        seat: "#141617",
      },
      b = {};
    for (const [f, J] of Object.entries(h))
      b[f] = new t.MeshStandardMaterial({
        color: new t.Color(J).convertSRGBToLinear(),
        roughness: f === "silver" ? 0.42 : f === "olive" ? 0.5 : f === "seat" ? 0.86 : 0.94,
        metalness: f === "silver" ? 0.55 : f === "olive" ? 0.05 : 0,
        flatShading: f !== "olive" && f !== "seat",
        emissive: f === "lamp" ? new t.Color(0.35, 0.35, 0.3) : f === "red" ? new t.Color(0.25, 0.02, 0.02) : new t.Color(0),
      });
    const p = new t.BoxGeometry(1, 1, 1),
      S = new t.IcosahedronGeometry(1, 0),
      x = new t.SphereGeometry(1, 10, 6),
      c = new t.CylinderGeometry(1, 1, 1, 8),
      P = new Map();
    function C(f, J, Ze, Je, ct, gt = k) {
      const Gt = f.clone(),
        Ot = new t.Matrix4().compose(
          new t.Vector3(...Ze),
          new t.Quaternion().setFromEuler(new t.Euler(...(ct || [0, 0, 0]))),
          new t.Vector3(...Je),
        );
      (Gt.applyMatrix4(Ot), P.has(gt) || P.set(gt, new Map()));
      const Xt = P.get(gt);
      (Xt.has(J) || Xt.set(J, []), Xt.get(J).push(Gt));
    }
    function Ne() {
      for (const [f, J] of P)
        for (const [Ze, Je] of J) {
          let ct = 0;
          const gt = Je.map((d) => {
              const Z = d.index ? d.toNonIndexed() : d;
              return ((ct += Z.attributes.position.count), Z);
            }),
            Gt = new Float32Array(ct * 3),
            Ot = new Float32Array(ct * 3);
          let Xt = 0;
          for (const d of gt)
            (Gt.set(d.attributes.position.array, Xt),
              Ot.set(d.attributes.normal.array, Xt),
              (Xt += d.attributes.position.array.length));
          const Wt = new t.BufferGeometry();
          (Wt.setAttribute("position", new t.BufferAttribute(Gt, 3)),
            Wt.setAttribute("normal", new t.BufferAttribute(Ot, 3)),
            Wt.computeBoundingSphere());
          const i = new t.Mesh(Wt, b[Ze]);
          ((i.receiveShadow = !0),
            (i.castShadow = !1),
            f.add(i),
            Je.forEach((d) => d.dispose()),
            gt.forEach((d) => d.dispose()));
        }
      P.clear();
    }
    const z = new t.Group();
    ((z.position.y = 0.89), k.add(z));
    const ce = new t.LatheGeometry(
      [
        new t.Vector2(0.205, -0.08),
        new t.Vector2(0.225, -0.02),
        new t.Vector2(0.246, 0.26),
        new t.Vector2(0.265, 0.43),
        new t.Vector2(0.205, 0.5),
        new t.Vector2(0.13, 0.53),
      ],
      8,
    );
    (C(ce, "wine", [0, 0, 0], [1, 1, 0.76], null, z),
      C(p, "rib", [0, -0.052, 0], [0.414, 0.064, 0.306], null, z),
      C(x, "wineDark", [0, 0.492, -0.087], [0.205, 0.105, 0.15], null, z),
      C(p, "wineDark", [0, 0.1, 0.186], [0.277, 0.146, 0.017], [0.04, 0, 0], z),
      C(p, "wine", [0, 0.162, 0.197], [0.22, 0.024, 0.012], null, z));
    for (const f of [-0.068, 0.068]) C(c, "cord", [f, 0.384, 0.173], [0.008, 0.132, 0.008], [0.03, 0, f * 0.7], z);
    C(c, "skin", [0, 0.55, 0.014], [0.078, 0.12, 0.075], null, z);
    const V = new t.Group();
    (V.position.set(0, 0.68, 0.013),
      z.add(V),
      C(x, "skin", [0, 0.04, 0.012], [0.145, 0.18, 0.131], null, V),
      C(S, "skinLight", [0, -0.017, 0.056], [0.113, 0.109, 0.094], null, V));
    for (const f of [-1, 1])
      (C(S, "skin", [f * 0.143, 0.037, 0.007], [0.032, 0.053, 0.028], null, V),
        C(p, "eye", [f * 0.05, 0.067, 0.133], [0.016, 0.012, 0.006], null, V),
        C(p, "hair", [f * 0.05, 0.084, 0.131], [0.03, 0.008, 0.008], [0, 0, -f * 0.08], V));
    (C(S, "skinLight", [0, 0.029, 0.149], [0.025, 0.033, 0.034], null, V),
      C(p, "skin", [0, -0.019, 0.137], [0.04, 0.007, 0.006], null, V),
      C(
        new t.SphereGeometry(1, 10, 5, 0, pe * 2, 0, pe * 0.6),
        "hair",
        [0, 0.079, -0.009],
        [0.153, 0.152, 0.144],
        null,
        V,
      ),
      C(x, "hair", [0, 0.151, -0.142], [0.084, 0.075, 0.081], null, V),
      C(c, "black", [0, 0.119, -0.124], [0.047, 0.037, 0.046], [1.04, 0, 0], V),
      C(S, "hairLight", [-0.058, 0.16, 0.015], [0.053, 0.029, 0.07], [0, 0.5, -0.2], V));
    const Me = new t.Group();
    ((Me.position.y = 0.8), k.add(Me), C(p, "black", [0, 0, 0], [0.37, 0.15, 0.3], null, Me));
    const je = [],
      lt = [];
    for (const f of [-1, 1]) {
      const J = new t.Group();
      ((J.rotation.order = "YXZ"),
        J.position.set(f * 0.112, 0.8, 0),
        k.add(J),
        je.push(J),
        C(new t.CylinderGeometry(0.105, 0.087, 0.22, 7), "black", [0, -0.075, 0], [1, 1, 1.2], null, J),
        C(c, "skin", [0, -0.267, 0], [0.073, 0.17, 0.077], null, J));
      const Ze = new t.Group();
      ((Ze.position.y = -0.355),
        J.add(Ze),
        (J.userData.knee = Ze),
        C(x, "skin", [0, -0.012, 0.013], [0.077, 0.074, 0.08], null, Ze),
        C(new t.CylinderGeometry(0.066, 0.047, 0.29, 7), "skin", [0, -0.15, 0], [1, 1, 1.06], null, Ze),
        C(c, "sole", [0, -0.308, 0], [0.051, 0.065, 0.055], null, Ze));
      const Je = new t.Group();
      ((Je.position.y = -0.35),
        Ze.add(Je),
        (J.userData.foot = Je),
        C(p, "sole", [0, -0.061, 0.074], [0.157, 0.048, 0.273], null, Je),
        C(x, "black", [0, -0.017, 0.054], [0.078, 0.068, 0.137], null, Je));
      for (let Ot = 0; Ot < 3; Ot++)
        C(p, "sole", [0, 0.031 - Ot * 0.006, 0.045 + Ot * 0.024], [0.074, 0.008, 0.007], [0.12, 0, 0], Je);
      const ct = new t.Group();
      ((ct.rotation.order = "YXZ"),
        ct.position.set(f * 0.264, 0.433, 0),
        z.add(ct),
        lt.push(ct),
        C(x, "wine", [0, -0.04, 0], [0.097, 0.112, 0.099], null, ct),
        C(new t.CylinderGeometry(0.087, 0.072, 0.235, 7), "wine", [0, -0.136, 0], [1, 1, 1.06], null, ct));
      const gt = new t.Group();
      ((gt.position.y = -0.263),
        ct.add(gt),
        (ct.userData.elbow = gt),
        C(new t.CylinderGeometry(0.074, 0.058, 0.204, 7), "wine", [0, -0.103, 0], [1, 1, 1.03], null, gt),
        C(c, "rib", [0, -0.218, 0], [0.061, 0.045, 0.061], null, gt));
      const Gt = new t.Group();
      ((Gt.position.y = -0.25),
        gt.add(Gt),
        (ct.userData.wrist = Gt),
        C(x, "skin", [0, -0.025, 0.01], [0.06, 0.073, 0.052], null, Gt),
        C(S, "skinLight", [-f * 0.05, -0.02, 0.035], [0.027, 0.036, 0.03], null, Gt));
    }
    const Ke = new t.Group();
    ((Ke.name = "Quad_pilotable"), (Ke.visible = !1), v.add(Ke));
    let ve = new t.Group();
    Ke.add(ve);
    let qe = [];
    // V32 : quad de jardin olive, lisible et realiste (carenages, garde-boues, porte-bagages,
    // phares, pneus a crampons). Memes points d'ancrage que la V31 (roues, guidon, phares).
    const rounded32 = new t.SphereGeometry(1, 14, 8);
    (C(p, "metal", [0, 0.36, 0], [0.62, 0.1, 1.5], null, ve),
      C(p, "quadDark", [0, 0.52, 0.04], [0.46, 0.3, 0.6], null, ve),
      C(rounded32, "olive", [0, 0.8, 0.32], [0.29, 0.16, 0.38], null, ve),
      C(rounded32, "seat", [0, 0.9, -0.3], [0.2, 0.075, 0.44], null, ve),
      C(p, "seat", [0, 0.86, -0.31], [0.36, 0.08, 0.66], null, ve),
      C(p, "olive", [0, 0.74, 0.66], [1.16, 0.1, 0.68], [0.06, 0, 0], ve),
      C(p, "olive", [0, 0.64, 1.0], [1.02, 0.2, 0.08], [-0.55, 0, 0], ve),
      C(p, "olive", [0, 0.76, -0.66], [1.16, 0.1, 0.64], [-0.05, 0, 0], ve),
      C(p, "olive", [0, 0.67, -0.99], [1.02, 0.17, 0.08], [0.5, 0, 0], ve));
    for (const f of [-0.66, 0.65])
      for (const J of [-1, 1])
        (C(p, "olive", [J * 0.66, 0.735, f], [0.37, 0.07, 0.44], null, ve),
          C(p, "olive", [J * 0.66, 0.655, f + 0.29], [0.37, 0.06, 0.22], [-0.75, 0, 0], ve),
          C(p, "olive", [J * 0.66, 0.655, f - 0.29], [0.37, 0.06, 0.22], [0.75, 0, 0], ve));
    for (const f of [-1, 1])
      (C(p, "quadDark", [f * 0.36, 0.63, 0], [0.1, 0.2, 0.64], null, ve),
        C(p, "quadDark", [f * 0.46, 0.42, -0.03], [0.24, 0.04, 0.48], null, ve));
    for (const [f, J] of [
      [0.72, 0.5],
      [-0.73, 0.56],
    ]) {
      for (const Ze of [-1, 1]) C(c, "silver", [Ze * 0.44, 0.87, f], [0.022, J, 0.022], [pe / 2, 0, 0], ve);
      for (const Ze of [-J / 2, 0, J / 2]) C(c, "silver", [0, 0.87, f + Ze], [0.022, 0.9, 0.022], [0, 0, pe / 2], ve);
    }
    (C(c, "silver", [0, 0.5, 1.07], [0.03, 0.72, 0.03], [0, 0, pe / 2], ve),
      C(c, "silver", [0, 0.72, 1.06], [0.026, 0.62, 0.026], [0, 0, pe / 2], ve));
    for (const f of [-1, 1])
      (C(c, "silver", [f * 0.34, 0.61, 1.06], [0.028, 0.26, 0.028], null, ve),
        C(c, "lamp", [f * 0.27, 0.76, 0.99], [0.075, 0.05, 0.075], [pe / 2, 0, 0], ve),
        C(p, "red", [f * 0.34, 0.68, -1.01], [0.15, 0.06, 0.03], null, ve));
    (C(c, "silver", [0, 1.0, 0.43], [0.026, 0.32, 0.026], [-0.3, 0, 0], ve),
      C(c, "metal", [0.3, 0.55, -0.95], [0.045, 0.32, 0.045], [pe / 2 - 0.2, 0, 0], ve));
    for (const f of [-0.66, 0.65])
      for (const J of [-1, 1]) {
        const Ze = new t.Group();
        (Ze.position.set(J * 0.68, 0.33, f), ve.add(Ze));
        const Je = new t.Group();
        (Ze.add(Je),
          qe.push({ pivot: Ze, spin: Je, front: f > 0, side: J, z: f }),
          (Ze.name = "Suspension_" + (f > 0 ? "avant" : "arriere") + "_" + (J < 0 ? "gauche" : "droite")),
          C(new t.CylinderGeometry(0.31, 0.31, 0.27, 18), "tyre", [0, 0, 0], [1, 1, 1], [0, 0, pe / 2], Je),
          C(new t.CylinderGeometry(0.19, 0.19, 0.282, 12), "silver", [J * 0.004, 0, 0], [1, 1, 1], [0, 0, pe / 2], Je),
          C(new t.CylinderGeometry(0.075, 0.075, 0.292, 8), "metal", [0, 0, 0], [1, 1, 1], [0, 0, pe / 2], Je));
        for (let ct = 0; ct < 18; ct++) {
          const gt = (ct / 18) * pe * 2;
          C(p, "tyre", [ct % 2 ? 0.065 : -0.065, Math.cos(gt) * 0.318, Math.sin(gt) * 0.318], [0.125, 0.05, 0.075], [gt, 0, 0], Je);
        }
      }
    let Xe = new t.Group();
    (Xe.position.set(0, 1.153, 0.424), ve.add(Xe), C(c, "metal", [0, 0, 0], [0.022, 0.84, 0.022], [0, 0, pe / 2], Xe));
    for (const f of [-1, 1]) C(c, "quadDark", [f * 0.37, 0, 0], [0.036, 0.15, 0.036], [0, 0, pe / 2], Xe);
    Ne();
    const _t = { frame: ve, wheels: qe, steering: Xe },
      Mt = (n.parkedCars || []).map((f, J) => ({
        spec: f,
        id: "voiture-" + J,
        initial: { x: f.position[0], z: f.position[1], rotation: f.angle || 0 },
        rig: f.rig24,
      }));
    function st(f) {
      return {
        id: f.id,
        type: "car",
        x: f.spec.position[0],
        z: f.spec.position[1],
        rotation: f.spec.angle || 0,
        scale: 1,
        yOffset: 0,
      };
    }
    function $(f) {
      return Mt.find((J) => J.id === f);
    }
    function U() {
      var f;
      return ((f = m.record) == null ? void 0 : f.type) === "car";
    }
    function He(f) {
      var Ze, Je, ct;
      const J = $(f == null ? void 0 : f.id);
      ((ve = ((Ze = J == null ? void 0 : J.rig) == null ? void 0 : Ze.frame) || _t.frame),
        (qe = ((Je = J == null ? void 0 : J.rig) == null ? void 0 : Je.wheels) || _t.wheels),
        (Xe = ((ct = J == null ? void 0 : J.rig) == null ? void 0 : ct.steering) || _t.steering),
        (_t.frame.visible = !J),
        J && (Ke.add(J.rig.root), J.rig.root.position.set(0, 0, 0), J.rig.root.rotation.set(0, 0, 0)));
    }
    const Ce = n.avatar22 || n.avatar21,
      xe = globalThis.MoulinAvatar22 || globalThis.MoulinAvatar21,
      H = Ce && xe ? xe(t, { asset: Ce }) : null;
    if (H) {
      for (const f of k.children) f.visible = !1;
      k.add(H.group);
    }
    const W = (H == null ? void 0 : H.hipHeight) || 0.8,
      D = new t.CircleGeometry(0.43, 20),
      De = new t.Mesh(
        D,
        new t.MeshBasicMaterial({
          color: 1587755,
          transparent: !0,
          opacity: 0.19,
          depthWrite: !1,
          polygonOffset: !0,
          polygonOffsetFactor: -2,
        }),
      );
    ((De.rotation.x = -pe / 2), (De.scale.y = 0.68), (De.position.y = 0.017), (De.renderOrder = 2), v.add(De));
    const ke = document.createElement("div");
    ((ke.className = "player19-hud"),
      (ke.hidden = !0),
      (ke.innerHTML =
        '<div class="player19-hint"><span class="player19-live"></span><strong>Promenade</strong><span class="player19-desktop">ZQSD / fl\xE8ches \xB7 Maj : courir \xB7 Glisser : regarder</span><span class="player19-touch-note">Joystick : marcher \xB7 Glisser la vue : regarder</span></div><div class="player19-pad" role="application" aria-label="Joystick de d\xE9placement"><span class="player19-pad-rim"></span><span class="player19-stick"></span><span class="player19-pad-label">MARCHER</span></div><button type="button" class="player20-vehicle" hidden><span class="player20-key">E</span><span data-vehicle-label>Monter sur le quad</span></button><div class="player19-actions"><button type="button" class="player19-run" aria-label="Maintenir pour courir"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="15" cy="4" r="2"/><path d="m12 8 3 3 4 1M12 8 9 12l-4 1m7-5 2 6-4 4-1 4m5-8 4 3 2 4"/></svg><span>Courir</span></button><button type="button" class="player21-jump" aria-label="Sauter" title="Sauter"><svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="13" cy="6" r="2.5" fill="currentColor" stroke="none"/><path d="m6 10 6 3 6-4m-6 4-2 5-5 4m5-4 7 1 3 4M23 15V4m-4 4 4-4 4 4M6 28h19"/></svg></button><button type="button" class="player21-boost" hidden aria-label="Maintenir le boost du quad"><span aria-hidden="true">\xBB</span><span>BOOST</span></button><button type="button" class="player20-brake" hidden aria-label="Maintenir pour freiner">Frein</button><div class="player19-zoom"><button type="button" data-player19-zoom="-1" aria-label="Rapprocher la cam\xE9ra">+</button><button type="button" data-player19-zoom="1" aria-label="\xC9loigner la cam\xE9ra">\u2212</button></div><button type="button" class="player19-centre" aria-label="Recentrer la cam\xE9ra">Recentrer</button></div>'),
      re.append(ke));
    const rt = ke.querySelector(".player19-pad"),
      $e = ke.querySelector(".player19-stick"),
      B = ke.querySelector(".player19-run"),
      F = ke.querySelector(".player20-vehicle"),
      g = ke.querySelector("[data-vehicle-label]"),
      G = ke.querySelector(".player20-brake");
    let Qe = null,
      Fe = null;
    const Le = ke.querySelector(".player21-jump"),
      pt = ke.querySelector(".player21-boost"),
      Ge = {
        enabled: !1,
        forward: 0,
        right: 0,
        running: !1,
        boost: !1,
        yaw: 0.36,
        pitch: 0.22,
        distance: 7.2,
        blocked: null,
      },
      m = {
        record: null,
        speed: 0,
        yaw: 0,
        steer: 0,
        travel: 0,
        scale: 1,
        previous: null,
        near: null,
        boost: !1,
        visualY: 0,
        pitch: 0,
        roll: 0,
        distance: 0,
        transitions: 0,
      },
      at = {
        grounded: !0,
        verticalSpeed: 0,
        gravity: 18,
        jumpSpeed: 6.4,
        coyote: 0.1,
        jumpBuffer: 0,
        jumps: 0,
        landings: 0,
        airTime: 0,
        waterRecoveries: 0,
        lastSafe: new t.Vector3(-5, 0, 12),
      };
    let ft = 0,
      ue = 0,
      se = 0,
      Ve = 0,
      vt = 0,
      me = !1,
      Re = null;
    const et = new Map(),
      kt = new Set(),
      M = new t.Vector3(-5, 0, 12),
      ee = new t.Vector2(),
      ge = new t.Vector3(),
      ae = new t.Vector3(),
      de = new t.Vector3(),
      oe = 0.24,
      y = [
        [0, 0],
        [oe, 0],
        [-oe, 0],
        [0, oe],
        [0, -oe],
      ],
      I = [
        ...(n.bridges || []).filter(
          (f) =>
            !(n.bridgeSurfaces || []).some(
              (J) => J.centre && f.centre && Math.hypot(J.centre[0] - f.centre[0], J.centre[1] - f.centre[1]) < 0.15,
            ),
        ),
        ...(n.bridgeSurfaces || []),
      ],
      Be = n.waterRegions || [],
      Se = n.channels || [];
    let N = 0,
      Ie = 0,
      E = 0,
      Y = pe,
      w = !1,
      be = null,
      ne = null,
      K = null,
      fe = null,
      Ee = he.fov;
    function bt(f, J) {
      return (n.islands || []).some((Ze) => n.inside([f, J], Ze));
    }
    function mt(f, J) {
      let Ze = -1 / 0;
      for (const Je of Be) n.inside([f, J], Je.poly) && (Ze = Math.max(Ze, Je.level));
      if (n.channelSample)
        for (const Je of Se) {
          const ct = n.channelSample([f, J], Je, Je.maxWidth * 0.5);
          ct.distance < ct.width * 0.5 && (Ze = Math.max(Ze, ct.height));
        }
      return Ze;
    }
    function Ct() {
      var f;
      et.clear();
      for (const J of ((f = n.forest) == null ? void 0 : f.records) || []) {
        const Ze = Math.floor(J.x / 10) + "," + Math.floor(J.z / 10);
        (et.has(Ze) || et.set(Ze, []),
          et
            .get(Ze)
            .push({ x: J.x, z: J.z, radius: Math.max(0.07, J.diameter * 0.85), base: T(J.x, J.z), height: J.height }));
      }
    }
    function Pt(f, J, Ze, Je = oe) {
      const ct = Math.floor(f / 10),
        gt = Math.floor(J / 10);
      for (let Gt = ct - 1; Gt <= ct + 1; Gt++)
        for (let Ot = gt - 1; Ot <= gt + 1; Ot++)
          for (const Xt of et.get(Gt + "," + Ot) || [])
            if (
              Math.hypot(f - Xt.x, J - Xt.z) < Xt.radius + Je &&
              Ze + 1.68 > Xt.base &&
              Ze < Xt.base + Xt.height * 0.72
            )
              return !0;
      return !1;
    }
    const jt = n.world22 || {},
      Dt =
        n.collisionFootprints ||
        jt.collisionFootprints ||
        (n.foundationFootprints || []).flatMap((f) =>
          f.name === "Moulin"
            ? [
                { ...f, u0: -4.31, u1: 4.31, v0: -7.22, v1: 7.22, y0: f.level ?? 0, y1: 14 },
                {
                  ...f,
                  name: "Veranda",
                  u0: 4.21,
                  u1: 7.1,
                  v0: -3.84,
                  v1: 2.04,
                  y0: f.level ?? 0,
                  y1: (f.level ?? 1.055) + 2.9,
                },
              ]
            : [
                {
                  ...f,
                  y0: f.y0 ?? f.level ?? -1 / 0,
                  y1: f.y1 ?? (f.name === "Dependance" ? 10 : f.name === "Niche" ? 7 : 1 / 0),
                },
              ],
        ),
      we = n.solidRects || jt.solidRects || [],
      We = [...Dt, ...we];
    function yt(f, J, Ze) {
      var i, d;
      const Je = Ze.angle || 0,
        ct = f - (Ze.cx ?? ((i = Ze.centre) == null ? void 0 : i[0]) ?? 0),
        gt = J - (Ze.cz ?? ((d = Ze.centre) == null ? void 0 : d[1]) ?? 0),
        Gt = ct * Math.cos(Je) - gt * Math.sin(Je),
        Ot = ct * Math.sin(Je) + gt * Math.cos(Je),
        Xt = Math.max(Ze.u0 - Gt, Gt - Ze.u1),
        Wt = Math.max(Ze.v0 - Ot, Ot - Ze.v1);
      return Math.hypot(Math.max(0, Xt), Math.max(0, Wt)) + Math.min(0, Math.max(Xt, Wt));
    }
    function Ft(f, J, Ze = oe, Je = -1 / 0, ct = 1 / 0) {
      for (const gt of We) {
        const Gt = gt.y0 ?? -1 / 0,
          Ot = gt.y1 ?? 1 / 0;
        if (!(Number.isFinite(Je) && (Je + 0.08 >= Ot || Je + ct <= Gt + 0.02)) && yt(f, J, gt) < Ze) return gt;
      }
      return null;
    }
    function Bt() {
      var Gt, Ot, Xt, Wt;
      const f =
          typeof n.getWeatherState == "function"
            ? n.getWeatherState()
            : typeof n.weather == "function"
              ? n.weather()
              : n.weather || {},
        J = typeof f == "string" ? { kind: f } : f || {},
        Ze = String(J.kind || J.type || J.mode || J.weather || "").toLowerCase(),
        Je = J.snowAmount ?? J.snow ?? J.snowfall,
        ct = (Gt = globalThis.moulin3D) == null ? void 0 : Gt.ambience,
        gt = ((Ot = n.getWindState) == null ? void 0 : Ot.call(n)) || {
          value: ((Xt = ct == null ? void 0 : ct.wind) == null ? void 0 : Xt.value) ?? 0,
          direction: ((Wt = ct == null ? void 0 : ct.windDirection) == null ? void 0 : Wt.value) || { x: 1, y: 0 },
        };
      return {
        weather: J,
        snow: typeof Je == "number" ? _e(Je, 0, 1) : Je === !0 || /snow|neige|winter/.test(Ze) ? 1 : 0,
        rain: Number(J.rain) || (/rain|pluie/.test(Ze) ? 1 : 0),
        wet: Number(J.wet) || 0,
        wind: Number(gt.value ?? gt.strength ?? gt) || 0,
        windDirection: gt.direction || { x: 1, y: 0 },
        facing: m.record ? m.yaw : Y,
      };
    }
    function Rt(f, J, Ze, Je = oe) {
      for (const ct of n.wallSupports || []) {
        if (Ze > ct.y - 0.12) continue;
        const gt = f - ct.x,
          Gt = J - ct.z;
        if (
          Math.abs(gt * ct.dx + Gt * ct.dz) < ct.length * 0.5 + Je &&
          Math.abs(gt * ct.dz - Gt * ct.dx) < ct.width * 0.5 + Je
        )
          return !0;
      }
      return !1;
    }
    function qt(f, J) {
      return (n.hillSteps || []).some((Ze) => {
        const Je = f - Ze.x,
          ct = J - Ze.z;
        return (
          Math.abs(Je * Ze.dx + ct * Ze.dz) <= Ze.length * 0.5 + 0.24 &&
          Math.abs(Je * Ze.dz - ct * Ze.dx) <= Ze.width * 0.5 + 0.12
        );
      });
    }
    function Kt(f, J, Ze, Je = oe) {
      var gt, Gt, Ot, Xt, Wt;
      for (const i of Mt) {
        if (i.id === ((gt = m.record) == null ? void 0 : gt.id)) continue;
        const d = i.spec,
          Z = f - d.position[0],
          ye = J - d.position[1],
          nt = d.angle || 0,
          xt = Z * Math.cos(nt) - ye * Math.sin(nt),
          ot = Z * Math.sin(nt) + ye * Math.cos(nt);
        if (Math.abs(xt) < 0.88 + Je && Math.abs(ot) < 2.13 + Je) return !0;
      }
      if (typeof ((Gt = n.props) == null ? void 0 : Gt.collides) == "function")
        return n.props.collides(f, J, Je, Ze, Ze + 1.72);
      const ct =
        typeof ((Ot = n.props) == null ? void 0 : Ot.getCollisionBoxes) == "function"
          ? n.props.getCollisionBoxes()
          : typeof ((Xt = n.props) == null ? void 0 : Xt.collisionBoxes) == "function"
            ? n.props.collisionBoxes()
            : ((Wt = n.props) == null ? void 0 : Wt.collisionBoxes) || [];
      for (const i of ct) {
        const d = i.box || i;
        if (
          !(!d.min || !d.max) &&
          f > d.min.x - Je &&
          f < d.max.x + Je &&
          J > d.min.z - Je &&
          J < d.max.z + Je &&
          Ze + 0.15 < d.max.y &&
          Ze + 1.65 > d.min.y
        )
          return !0;
      }
      return !1;
    }
    const ro = (
      f,
      J = ((Je) => ((Je = f.centre) == null ? void 0 : Je[0]))() || 0,
      Ze = ((ct) => ((ct = f.centre) == null ? void 0 : ct[1]))() || 0,
    ) =>
      typeof f.topAt == "function"
        ? f.topAt(J, Ze)
        : Number.isFinite(f.startLevel) && Number.isFinite(f.endLevel)
          ? t.MathUtils.lerp(f.startLevel, f.endLevel, _e((oo(f, J, Ze).u + f.length * 0.5) / f.length, 0, 1))
          : Number.isFinite(f.topLevel)
            ? f.topLevel
            : (f.deckLevel ?? f.height ?? 0) + 0.07;
    function oo(f, J, Ze) {
      var Gt, Ot;
      const Je = J - (((Gt = f.centre) == null ? void 0 : Gt[0]) || 0),
        ct = Ze - (((Ot = f.centre) == null ? void 0 : Ot[1]) || 0),
        gt = f.angle ?? f.angleRadians ?? 0;
      return { u: Je * Math.cos(gt) - ct * Math.sin(gt), v: Je * Math.sin(gt) + ct * Math.cos(gt) };
    }
    function uo(f, J, Ze = 0) {
      let Je = null;
      for (const ct of I) {
        let gt = !1;
        if (ct.polygon) gt = n.inside([f, J], ct.polygon);
        else {
          const Gt = oo(ct, f, J);
          gt =
            Math.abs(Gt.u) <= ct.length * 0.5 + 0.09 && Math.abs(Gt.v) <= Math.max(0.12, ct.width * 0.5 - Ze + 0.025);
        }
        gt && (!Je || ro(ct, f, J) > ro(Je, f, J)) && (Je = ct);
      }
      return Je;
    }
    function Tt(f, J) {
      for (const Ze of I) {
        if (Ze.polygon || !Ze.centre) continue;
        const Je = oo(Ze, f, J),
          ct = Math.abs(Je.u) - Ze.length * 0.5;
        if (ct < 0 || ct > 1 || Math.abs(Je.v) > Ze.width * 0.5 - 0.045) continue;
        const gt = T(f, J),
          Gt = ro(Ze, f, J);
        if (!(Math.abs(Gt - gt) > 0.96 || Yo(f, J)))
          return { height: Math.max(gt, Gt + (gt - Gt) * Math.min(1, ct)), type: "approach", bridge: Ze };
      }
      return null;
    }
    function Jt(f, J, Ze = 0) {
      return (n.wallSupports || []).filter((Je) => {
        const ct = f - Je.x,
          gt = J - Je.z;
        return (
          Math.abs(ct * Je.dx + gt * Je.dz) <= Je.length * 0.5 + Ze &&
          Math.abs(ct * Je.dz - gt * Je.dx) <= Je.width * 0.5 + Ze
        );
      });
    }
    function io(f, J) {
      var Wt;
      const Ze = uo(f, J);
      if (Ze) return { height: ro(Ze, f, J), type: "bridge", bridge: Ze };
      const Je = Tt(f, J);
      if (Je) return Je;
      const ct = T(f, J),
        gt = Yo(f, J);
      let Gt = gt ? ct : Math.max(ct, le(f, J));
      const Ot = (Wt = n.passageSupport || jt.supportHeight) == null ? void 0 : Wt(f, J);
      !gt && Number.isFinite(Ot) && (Gt = Math.max(Gt, Ot));
      const Xt = Jt(f, J);
      for (const i of Xt) Gt = Math.max(Gt, i.y + 0.055);
      return { height: Gt, type: gt ? "water" : Xt.length ? "wall" : "land", wall: Xt[0] || null };
    }
    function po(f, J) {
      return io(f, J).height;
    }
    function Yo(f, J) {
      if (!n.wetAt([f, J], 0) || bt(f, J)) return !1;
      const Ze = mt(f, J),
        Je = T(f, J);
      return Number.isFinite(Ze) ? Je < Ze + 0.035 : !0;
    }
    function ao(f, J) {
      return !uo(f, J) && Yo(f, J);
    }
    function wo(f, J, Ze, Je = 0) {
      return !Number.isFinite(f) || !Number.isFinite(J) || f < X.x0 + 1 || f > X.x1 - 1 || J < X.z0 + 1 || J > X.z1 - 1
        ? { ok: !1, reason: "limite" }
        : Ft(f, J, oe, Ze, 1.75)
          ? { ok: !1, reason: "b\xE2timent" }
          : Rt(f, J, Ze + Je)
            ? { ok: !1, reason: "muret" }
            : Pt(f, J, Ze)
              ? { ok: !1, reason: "tronc" }
              : Kt(f, J, Ze)
                ? { ok: !1, reason: "objet" }
                : { ok: !0 };
    }
    function zo(f, J, Ze, Je = 0.15) {
      const ct = io(f, J),
        gt = ct.height;
      if (!Number.isFinite(gt)) return { ok: !1, reason: "sol" };
      const Gt = qt(f, J) ? 0.46 : 0.34,
        Ot = wo(f, J, Ze ?? gt, Number.isFinite(Ze) ? Gt : 0);
      if (!Ot.ok) return Ot;
      if (!ct.bridge) {
        for (const [Xt, Wt] of y) if (ao(f + Xt * 0.65, J + Wt * 0.65)) return { ok: !1, reason: "eau" };
      }
      if (Number.isFinite(Ze)) {
        if (gt - Ze > Math.max(Gt, Je * 1.1)) return { ok: !1, reason: "marche" };
        if (!ct.bridge && !qt(f, J) && ct.type !== "wall") {
          const Xt = (T(f + 0.28, J) - T(f - 0.28, J)) / 0.56,
            Wt = (T(f, J + 0.28) - T(f, J - 0.28)) / 0.56;
          if (Math.hypot(Xt, Wt) > 1.15) return { ok: !1, reason: "pente" };
        }
      }
      return { ok: !0, height: gt, support: ct.type, bridge: ct.bridge };
    }
    function Oo(f, J, Ze) {
      const Je = wo(f, J, Ze);
      if (!Je.ok) return Je;
      const ct = io(f, J);
      return ct.type !== "water" && ct.height > Ze + 0.16
        ? { ok: !1, reason: "relief" }
        : { ok: !0, height: ct.height, support: ct.type };
    }
    function Q(f, J) {
      if (!Number.isFinite(f) || !Number.isFinite(J)) return !1;
      const Ze = Math.hypot(f, J),
        Je = Math.max(1, Math.ceil(Ze / 0.12)),
        ct = f / Je,
        gt = J / Je;
      let Gt = !1;
      function Ot(Xt, Wt, i) {
        const d = at.grounded ? zo(Xt, Wt, M.y, i) : Oo(Xt, Wt, M.y);
        return d.ok
          ? ((M.x = Xt),
            (M.z = Wt),
            at.grounded &&
              (M.y - d.height > 0.34
                ? ((at.grounded = !1), (at.verticalSpeed = 0), (at.coyote = 0.1))
                : (M.y = d.height)),
            (Ge.blocked = null),
            (Gt = !0),
            !0)
          : ((Ge.blocked = d.reason), !1);
      }
      for (let Xt = 0; Xt < Je; Xt++)
        Ot(M.x + ct, M.z + gt, Ze / Je) ||
          (Math.abs(ct) > 1e-7 && Ot(M.x + ct, M.z, Math.abs(ct)),
          Math.abs(gt) > 1e-7 && Ot(M.x, M.z + gt, Math.abs(gt)));
      return (v.position.copy(M), Gt);
    }
    function Oe() {
      return !Ge.enabled || m.record ? !1 : ((at.jumpBuffer = 0.15), n.markDirty(), !0);
    }
    function ut(f) {
      var Ze;
      const J = Math.abs(at.verticalSpeed);
      ((M.y = f),
        (at.grounded = !0),
        (at.verticalSpeed = 0),
        (at.airTime = 0),
        (at.coyote = 0.1),
        at.landings++,
        at.lastSafe.copy(M),
        J > 2.2 && ((Ze = n.audioEvents) == null || Ze.call(n, "land", { speed: J })));
    }
    function At(f) {
      var ct, gt;
      at.jumpBuffer > 0 &&
        ((at.jumpBuffer = Math.max(0, at.jumpBuffer - f)),
        (at.grounded || at.coyote > 0) &&
          ((at.verticalSpeed = at.jumpSpeed),
          (at.grounded = !1),
          (at.coyote = 0),
          (at.jumpBuffer = 0),
          at.jumps++,
          (at.airTime = 0),
          (ct = n.audioEvents) == null || ct.call(n, "jump", {})));
      const J = io(M.x, M.z);
      if (at.grounded) {
        if (J.type === "water") {
          (M.copy(at.lastSafe), at.waterRecoveries++);
          return;
        }
        if (M.y - J.height > 0.34) ((at.grounded = !1), (at.verticalSpeed = 0));
        else {
          ((M.y = J.height), at.lastSafe.copy(M), (at.coyote = 0.1));
          return;
        }
      }
      ((at.coyote = Math.max(0, at.coyote - f)), (at.airTime += f));
      const Ze = M.y;
      at.verticalSpeed -= at.gravity * f;
      const Je = Ze + at.verticalSpeed * f;
      if (at.verticalSpeed <= 0 && Ze >= J.height - 0.1 && Je <= J.height + 0.025 && J.type !== "water") {
        ut(J.height);
        return;
      }
      if (J.type === "water" && Je <= mt(M.x, M.z) + 0.08) {
        (M.copy(at.lastSafe),
          (at.verticalSpeed = 0),
          (at.grounded = !0),
          at.waterRecoveries++,
          (Ge.blocked = "eau"),
          ee.set(0, 0),
          (gt = n.audioEvents) == null || gt.call(n, "water-step", {}));
        return;
      }
      ((M.y = Je),
        M.y < J.height - 0.5 &&
          J.type !== "water" &&
          (M.copy(at.lastSafe), (at.verticalSpeed = 0), (at.grounded = !0), ee.set(0, 0)));
    }
    function It(f, J, Ze = m.yaw, Je, ct = 0.1) {
      const gt = U(),
        Gt = m.scale || 1,
        Ot = Math.sin(Ze),
        Xt = Math.cos(Ze),
        Wt = uo(f, J),
        i = gt ? 0.23 : Math.min(1.02, 0.92 * Gt),
        d = io(f, J);
      if (Wt && Number.isFinite(Wt.width) && Wt.width < (gt ? 2.06 : 1.62) * Gt)
        return { ok: !1, reason: "pont trop \xE9troit" };
      const Z = gt
          ? [
              [0, 0],
              [-0.84, -1.3],
              [0.84, -1.3],
              [-0.84, 1.27],
              [0.84, 1.27],
              [-0.84, -2.12],
              [0, -2.16],
              [0.84, -2.12],
              [-0.84, 2.12],
              [0, 2.16],
              [0.84, 2.12],
              [-0.91, 0],
              [0.91, 0],
            ]
          : [
              [0, 0],
              [-0.68, -0.66],
              [0.68, -0.66],
              [-0.68, 0.65],
              [0.68, 0.65],
              [0, 1.04],
              [0, -1.04],
            ],
        ye = [];
      for (const [Qt, Yt] of Z) {
        const Et = f + (Xt * Qt + Ot * Yt) * Gt,
          Zt = J + (-Ot * Qt + Xt * Yt) * Gt,
          bo = io(Et, Zt),
          go = Number.isFinite(Je) ? Math.max(Je, bo.height - i) : bo.height;
        if (!Number.isFinite(bo.height)) return { ok: !1, reason: "sol" };
        if (Et < X.x0 + 1 || Et > X.x1 - 1 || Zt < X.z0 + 1 || Zt > X.z1 - 1) return { ok: !1, reason: "limite" };
        if (Ft(Et, Zt, gt ? 0.055 : 0.15, go, 1.85 * Gt)) return { ok: !1, reason: "b\xE2timent" };
        if (Rt(Et, Zt, go + i, 0.12)) return { ok: !1, reason: "muret trop haut" };
        if (Pt(Et, Zt, go, 0.17)) return { ok: !1, reason: "tronc" };
        if (Kt(Et, Zt, go, 0.12)) return { ok: !1, reason: "objet" };
        if (ao(Et, Zt)) return { ok: !1, reason: "eau" };
        ye.push(bo.height);
      }
      const nt = (ye[1] + ye[2]) * 0.5,
        xt = (ye[3] + ye[4]) * 0.5,
        ot = (ye[1] + ye[3]) * 0.5,
        l = ((ye[2] + ye[4]) * 0.5 - ot) / ((gt ? 1.68 : 1.36) * Gt),
        j = (xt - nt) / ((gt ? 2.57 : 1.31) * Gt),
        ie = Math.atan(Math.hypot(l, j));
      if (ie > (pe * (gt ? 28 : 56)) / 180) return { ok: !1, reason: "pente", slope: ie };
      if (Math.max(...ye) - Math.min(...ye) > (gt ? 1.7 : 3.2) * Gt) return { ok: !1, reason: "terrain accident\xE9" };
      const ze = Math.max((nt + xt) * 0.5, d.height - 0.21 * Gt),
        Ye = ct * Math.tan(ie) + 0.06;
      if (Number.isFinite(Je) && (ze - Je > Math.max(i + 0.02, Ye) || Je - ze > Math.max(1.08, Ye)))
        return { ok: !1, reason: "d\xE9nivel\xE9" };
      const zt = Math.hypot(l, 1, j),
        ht = -Math.atan(j),
        Lt = Math.asin(_e(l / zt, -1, 1));
      return { ok: !0, height: ze, pitch: ht, roll: Lt, slope: ie, wheelHeights: ye.slice(1, 5), stepCap: i };
    }
    const Vt = new t.Vector3(),
      Ut = new t.Vector3(),
      eo = [];
    function mo(f = 0) {
      v.updateMatrixWorld(!0);
      const J = m.scale || 1;
      (ve.getWorldQuaternion(vo), Ut.set(0, 1, 0).applyQuaternion(vo).normalize());
      const Ze = Math.max(0.42, Ut.y);
      eo.length = 0;
      for (const Je of qe) {
        Je.pivot.rotation.y = Je.front ? m.steer : 0;
        const ct = Je.restY ?? 0.33,
          gt = Je.radius ?? 0.322;
        (Vt.set(Je.x ?? Je.side * 0.68, ct, Je.z), ve.localToWorld(Vt), R.worldToLocal(Vt));
        const Gt = po(Vt.x, Vt.z),
          Ot = ct + _e((Gt + (gt * J) / Ze - Vt.y) / (J * Ze), -0.13, 0.09);
        ((Je.pivot.position.y = f ? q(Je.pivot.position.y, Ot, 22, f) : Ot),
          (Je.spin.rotation.x = m.travel / (gt * J)),
          Je.pivot.updateWorldMatrix(!0, !1),
          Je.pivot.getWorldPosition(Vt),
          R.worldToLocal(Vt),
          Vt.addScaledVector(Ut, -gt * J));
        const Xt = po(Vt.x, Vt.z);
        eo.push({
          x: Vt.x,
          y: Xt,
          z: Vt.z,
          grounded: Math.abs(Vt.y - Xt) < 0.24 * J,
          suspension: Je.pivot.position.y - ct,
        });
      }
    }
    const vo = new t.Quaternion();
    function fo(f, J, Ze) {
      const Je = m.speed,
        ct = kt.has(" "),
        gt = Ge.boost || kt.has("shift"),
        Gt = (Ge.running || Ge.boost) && J >= 0 ? 1 : J,
        Ot = U() ? (gt ? 16 : 10) : gt ? 15 : 8.5;
      if (ct) m.speed = q(m.speed, 0, 14, f);
      else if (Math.abs(Gt) > 0.08) {
        const ze = Gt > 0 ? Ot * Gt : 3 * Gt,
          Ye = m.speed * Gt < 0 ? 12 : gt ? 8.2 : 5.8;
        m.speed += _e(ze - m.speed, -Ye * f, Ye * f);
      } else {
        const ze = 3.8 * f;
        m.speed = Math.abs(m.speed) < ze ? 0 : m.speed - Math.sign(m.speed) * ze;
      }
      ((m.speed = _e(m.speed, -3, U() ? 16 : 15)), (m.boost = gt && Gt > 0 && !ct));
      const Xt = _e(0.53 - Math.abs(m.speed) * 0.019, 0.23, 0.53);
      m.steer = q(m.steer, -Ze * Xt, 9, f);
      const Wt = _e((m.speed / (U() ? 2.57 : 1.34)) * Math.tan(m.steer), -1.45, 1.45),
        i = m.yaw + Wt * f;
      It(M.x, M.z, i, M.y).ok && (m.yaw = Math.atan2(Math.sin(i), Math.cos(i)));
      const d = m.speed * f,
        Z = Math.max(1, Math.ceil(Math.abs(d) / 0.12));
      let ye = 0,
        nt = null;
      for (let ze = 0; ze < Z; ze++) {
        const Ye = (Math.sin(m.yaw) * d) / Z,
          zt = (Math.cos(m.yaw) * d) / Z,
          ht = It(M.x + Ye, M.z + zt, m.yaw, M.y, Math.abs(d) / Z);
        if (!ht.ok) {
          ((m.speed = 0), (Ge.blocked = ht.reason));
          break;
        }
        ((M.x += Ye), (M.z += zt), (M.y = ht.height), (nt = ht), (ye += d / Z), (Ge.blocked = null));
      }
      ((ft = f ? Math.abs(ye) / f : 0),
        (m.distance = Math.abs(ye)),
        (m.travel += ye),
        (m.visualY = _e(q(m.visualY, M.y, 18, f), M.y - 0.035 * m.scale, M.y + 0.045 * m.scale)),
        (De.position.y = po(M.x, M.z) - m.visualY + 0.017),
        (De.material.opacity = 0.19),
        v.position.set(M.x, m.visualY, M.z),
        (Ke.rotation.y = m.yaw));
      const xt = nt || It(M.x, M.z, m.yaw),
        ot = xt.ok ? xt.pitch : m.pitch,
        tt = xt.ok ? xt.roll : m.roll;
      ((m.pitch = ot), (m.roll = tt));
      const l = _e((m.speed - Je) / Math.max(f, 1 / 120), -9, 7),
        j = _e(ot - l * 0.004, -1.02, 1.02),
        ie = _e(tt + m.steer * m.speed * 0.005, -0.98, 0.98);
      ((ve.rotation.x = _e(q(ve.rotation.x, j, 13, f), j - 0.085, j + 0.085)),
        (ve.rotation.z = _e(q(ve.rotation.z, ie, 13, f), ie - 0.075, ie + 0.075)),
        mo(f),
        An(),
        ia(f),
        fn(),
        Eo(f),
        n.markDirty());
    }
    function Do(f) {
      if (((f = _e(f, 0, 0.06)), (wn.value = performance.now() / 1e3), !Ge.enabled)) return;
      let J =
          Ge.forward +
          (kt.has("z") || kt.has("w") || kt.has("arrowup") ? 1 : 0) -
          (kt.has("s") || kt.has("arrowdown") ? 1 : 0),
        Ze =
          Ge.right +
          (kt.has("d") || kt.has("arrowright") ? 1 : 0) -
          (kt.has("q") || kt.has("a") || kt.has("arrowleft") ? 1 : 0);
      if (m.record) {
        fo(f, _e(J, -1, 1), _e(Ze, -1, 1));
        return;
      }
      const Je = Math.hypot(J, Ze);
      Je > 1 && ((J /= Je), (Ze /= Je));
      const ct = Ge.running || kt.has("shift") ? 5.25 : 1.85,
        gt = (-Math.sin(Ge.yaw) * J + Math.cos(Ge.yaw) * Ze) * ct,
        Gt = (-Math.cos(Ge.yaw) * J - Math.sin(Ge.yaw) * Ze) * ct,
        Ot = 1 - Math.exp(-(at.grounded ? 11 : 4.5) * f);
      ((ee.x += (gt - ee.x) * Ot), (ee.y += (Gt - ee.y) * Ot));
      const Xt = M.x,
        Wt = M.z,
        i = Math.max(1, Math.ceil(f / (1 / 90))),
        d = f / i;
      for (let ye = 0; ye < i; ye++) (At(d), ee.lengthSq() > 1e-4 && Q(ee.x * d, ee.y * d));
      (v.position.copy(M),
        (De.position.y = po(M.x, M.z) - M.y + 0.017),
        (De.material.opacity = _e(0.19 - (M.y - po(M.x, M.z)) * 0.045, 0.07, 0.19)));
      const Z = Math.hypot(M.x - Xt, M.z - Wt);
      if (((ft = f > 0 ? Z / f : 0), Z > 1e-4)) {
        const ye = Math.atan2(M.x - Xt, M.z - Wt),
          nt = Math.atan2(Math.sin(ye - Y), Math.cos(ye - Y));
        ((Y += nt * (1 - Math.exp(-14 * f))), (se = q(se, _e(-nt * ft * 0.015, -0.07, 0.07), 10, f)));
      } else se = q(se, 0, 10, f);
      (_o(f, Z), fn(), Eo(f), n.markDirty());
    }
    function ho(f, J) {
      if (m.record && !me) return !1;
      const Ze = zo(f, J);
      return Ze.ok
        ? (M.set(f, Ze.height, J),
          v.position.copy(M),
          ge.copy(M).add(new t.Vector3(0, 1, 0)),
          ee.set(0, 0),
          (at.grounded = !0),
          (at.verticalSpeed = at.jumpBuffer = at.airTime = 0),
          (at.coyote = 0.1),
          at.lastSafe.copy(M),
          (Ge.blocked = null),
          (w = !0),
          !0)
        : !1;
    }
    function Xo() {
      const f = jt.entrySpawn;
      return !f || (m.record && !So(!0)) || !ho(f.x, f.z)
        ? !1
        : ((Y = f.rotation || 0),
          (k.rotation.y = Y),
          (Ge.yaw = Y + pe),
          Ko(),
          jo(),
          Ge.enabled && Eo(0, !0),
          n.markDirty(),
          !0);
    }
    function Ko() {
      (kt.clear(),
        (Ge.forward = Ge.right = 0),
        (Ge.running = !1),
        (Ge.boost = !1),
        (at.jumpBuffer = 0),
        ee.set(0, 0),
        (Fe = null),
        pt.classList.remove("is-held"),
        (be = ne = fe = null),
        (K = null),
        ($e.style.transform = "translate(-50%,-50%)"),
        B.classList.remove("is-held"),
        (Qe = null),
        G.classList.remove("is-held"));
    }
    function ln(f, J) {
      ((Ge.forward = _e(Number(f) || 0, -1, 1)), (Ge.right = _e(Number(J) || 0, -1, 1)));
    }
    function jo() {
      ((Ge.yaw = (m.record ? m.yaw : Y) + pe),
        (Ge.pitch = m.record ? 0.62 : 0.22),
        (Ge.distance = m.record ? 17 : 7.2),
        n.markDirty());
    }
    function an(f, J, Ze) {
      return Ft(f, J, 0.15, Ze, 0.16) ? !0 : Ze < T(f, J) + 0.8;
    }
    function Eo(f, J = !1) {
      const Ze = Math.max(
        50,
        Math.min(84, (2 * Math.atan(Math.tan((21 * Math.PI) / 180) / Math.max(0.1, he.aspect)) * 180) / Math.PI),
      );
      Math.abs(he.fov - Ze) > 0.01 && ((he.fov = Ze), he.updateProjectionMatrix());
      const Je = new t.Vector3(M.x, (m.record ? m.visualY : M.y) + (m.record ? 1.3 : 1.02), M.z);
      ge.lerp(Je, J ? 1 : 1 - Math.exp(-10 * f));
      const ct = Math.cos(Ge.pitch) * Ge.distance,
        gt = Math.sin(Ge.pitch) * Ge.distance,
        Gt = Ge.yaw - (!m.record && he.aspect < 0.85 ? 0.12 : 0);
      ae.set(ge.x + Math.sin(Gt) * ct, ge.y + gt, ge.z + Math.cos(Gt) * ct);
      let Ot = 1;
      for (let Xt = 2; Xt <= 20; Xt++) {
        const Wt = Xt / 20,
          i = ge.x + (ae.x - ge.x) * Wt,
          d = ge.z + (ae.z - ge.z) * Wt,
          Z = ge.y + (ae.y - ge.y) * Wt;
        if (an(i, d, Z)) {
          Ot = Math.max(0.2, Wt - 0.07);
          break;
        }
      }
      (Ot < 1 && ae.lerpVectors(ge, ae, Ot),
        (ae.x = _e(ae.x, X.x0, X.x1)),
        (ae.z = _e(ae.z, X.z0, X.z1)),
        (ae.y = Math.max(ae.y, T(ae.x, ae.z) + 1.3)),
        he.position.lerp(ae, J ? 1 : 1 - Math.exp(-11 * f)),
        (he.position.y = Math.max(he.position.y, T(he.position.x, he.position.z) + 1.1)),
        te.target.copy(ge),
        he.lookAt(ge),
        he.updateMatrixWorld());
    }
    function tn(f) {
      if (((f = !!f), f !== Ge.enabled)) {
        if (!f && m.record && !So(!0)) return !1;
        if (
          ((Ge.enabled = f),
          f || ((ft = 0), (ue = 0)),
          (v.visible = f),
          (ke.hidden = !f),
          A.classList.toggle("player19-active", f),
          Ko(),
          f)
        ) {
          (Ct(), (Ee = he.fov), (te.enabled = !1));
          const J = jt.entrySpawn;
          if (
            (J && ho(J.x, J.z) && ((Y = J.rotation || 0), (k.rotation.y = Y), (Ge.yaw = Y + pe)), !w && !ho(-5, 12))
          ) {
            for (const Ze of [
              [-3, 11],
              [-4, -19],
              [-1, -25],
            ])
              if (ho(...Ze)) break;
          }
          (zo(M.x, M.z).ok || ho(-4, -19),
            (he.fov = 50),
            he.updateProjectionMatrix(),
            jo(),
            Eo(0, !0),
            a.focus({ preventScroll: !0 }));
        } else ((he.fov = Ee), he.updateProjectionMatrix());
        n.markDirty();
      }
    }
    function To(f, J, Ze, Je, ct, gt, Gt = !1) {
      const Ot = _e(Math.hypot(Ze, Je), 0.04, ct + gt - 0.003),
        Xt = _e((Ot * Ot - ct * ct - gt * gt) / (2 * ct * gt), -0.998, 0.998),
        Wt = Math.acos(Xt),
        i = Math.atan2(Ze, Je) + (Gt ? 1 : -1) * Math.atan2(gt * Math.sin(Wt), ct + gt * Math.cos(Wt));
      ((f.rotation.x = -i), (J.rotation.x = Gt ? Wt : -Wt));
    }
    function _o(f, J) {
      if (H) {
        ((E += f),
          (N += J * 4),
          (Ie = q(Ie, Math.min(1, ft / 2), 11, f)),
          (ue = q(ue, _e((ft - 2.3) / 2.4, 0, 1), 11, f)),
          k.position.set(0, 0, 0),
          k.rotation.set(0, Y, se),
          H.update(f, {
            speed: ft,
            running: Ge.running || kt.has("shift"),
            grounded: at.grounded,
            verticalSpeed: at.verticalSpeed,
            riding: !1,
            steering: 0,
            distance: J,
            ...Bt(),
          }));
        return;
      }
      const Ze = 1 - Math.exp(-11 * f),
        Je = _e((ft - 2.3) / 2.4, 0, 1);
      ((ue += (Je - ue) * Ze), (Ie += (_e(ft / 1.7, 0, 1) - Ie) * Ze));
      const ct = 1.16 + ue * 0.63;
      ((N += (J / ct) * pe * 2), (E += f));
      const gt = 0.66 - ue * 0.17,
        Gt = 0.702,
        Ot = [];
      let Xt = 0;
      for (let Wt = 0; Wt < 2; Wt++) {
        const i = (((N / (pe * 2) + Wt * 0.5) % 1) + 1) % 1,
          d = i < gt,
          Z = d ? i / gt : (i - gt) / (1 - gt),
          ye = ct * gt * Ie,
          nt = d ? ye * (0.5 - Z) : ye * (-0.5 + Z * Z * (3 - 2 * Z)),
          xt = d ? 0 : Math.sin(Z * pe) * (0.08 + ue * 0.15) * Ie,
          ot = (Wt ? 1 : -1) * 0.112,
          tt = M.x + Math.cos(Y) * ot + Math.sin(Y) * nt,
          l = M.z - Math.sin(Y) * ot + Math.cos(Y) * nt,
          j = _e(po(tt, l) - M.y, -0.18, 0.18);
        (Ot.push({ z: nt, y: 0.085 + j + xt, isStance: d, q: Z }),
          d && (Xt = Math.min(Xt, 0.085 + j + Math.sqrt(Math.max(0.02, Gt * Gt - nt * nt)) - 0.8)));
      }
      if (!at.grounded) {
        Xt = 0;
        for (const Wt of Ot) ((Wt.y = 0.14), (Wt.z = 0.02));
      }
      ((Xt -= 0.009 * Ie),
        k.position.set(0, Xt, 0),
        k.rotation.set(0, Y, Math.sin(N) * 0.012 * Ie + se),
        z.rotation.set(
          ue * 0.16 + 0.025 * Ie + Math.sin(E * 1.8) * 0.006 * (1 - Ie),
          Math.sin(N) * 0.045 * Ie,
          Math.sin(N) * 0.013 * Ie,
        ),
        (Me.rotation.y = -Math.sin(N) * 0.025 * Ie),
        (V.rotation.y = -z.rotation.y * 0.4));
      for (let Wt = 0; Wt < 2; Wt++) {
        const i = je[Wt],
          d = Ot[Wt];
        ((i.rotation.y = 0),
          (i.rotation.z = (Wt ? 1 : -1) * 0.012),
          To(i, i.userData.knee, d.z, 0.8 + Xt - d.y, 0.355, 0.35, !0),
          i.userData.foot.rotation.set(
            -i.rotation.x -
              i.userData.knee.rotation.x +
              (d.isStance ? Math.max(0, d.q - 0.72) * 0.55 : Math.sin(d.q * pe) * -0.17),
            0,
            0,
          ));
        const Z = N + Wt * pe;
        (lt[Wt].rotation.set(
          Math.sin(Z) * (0.3 + ue * 0.36) * Ie,
          (Wt ? 1 : -1) * 0.05,
          (Wt ? 1 : -1) * (0.055 + Ie * 0.015),
        ),
          (lt[Wt].userData.elbow.rotation.x = -(0.22 + ue * 0.76 + Math.sin(Z + 1.1) * 0.12 * Ie)),
          (lt[Wt].userData.wrist.rotation.x = -0.04 - Math.sin(Z) * 0.035 * Ie));
      }
    }
    function fn(f) {
      var Ze, Je, ct;
      if (((m.near = null), !m.record))
        for (const gt of ((Ze = n.props) == null ? void 0 : Ze.records) || []) {
          if (gt.type !== "quad") continue;
          const Gt = Math.hypot(gt.x - M.x, gt.z - M.z);
          Gt < 2.65 * Math.max(0.75, gt.scale || 1) &&
            (!m.near || Gt < m.near.distance) &&
            (m.near = { id: gt.id, distance: Gt });
        }
      if (!m.record)
        for (const gt of Mt) {
          const Gt = st(gt),
            Ot = Math.hypot(Gt.x - M.x, Gt.z - M.z);
          Ot < 3.05 && (!m.near || Ot < m.near.distance) && (m.near = { id: Gt.id, type: "car", distance: Ot });
        }
      const J =
        Ge.enabled +
        ":" +
        (m.record
          ? "ride:" + m.record.id + ":" + (Math.abs(m.speed) > 0.65) + ":" + m.boost
          : "walk:" + (((Je = m.near) == null ? void 0 : Je.id) || "")) +
        ":" +
        (f || "");
      J !== Re &&
        ((Re = J),
        (F.hidden = !Ge.enabled || (!m.record && !m.near)),
        (g.textContent =
          f ||
          (m.record
            ? Math.abs(m.speed) > 0.65
              ? "Ralentir pour descendre"
              : U()
                ? "Sortir de la voiture"
                : "Descendre du quad"
            : ((ct = m.near) == null ? void 0 : ct.type) === "car"
              ? "Conduire la voiture"
              : "Monter sur le quad")),
        ke.classList.toggle("player20-driving", !!m.record),
        (G.hidden = !m.record),
        (Le.hidden = !!m.record),
        (pt.hidden = !m.record),
        pt.classList.toggle("is-held", !!m.boost),
        (B.querySelector("span").textContent = m.record ? "Gaz" : "Courir"),
        B.setAttribute("aria-label", m.record ? "Maintenir pour acc\xE9l\xE9rer" : "Maintenir pour courir"),
        (ke.querySelector(".player19-pad-label").textContent = m.record ? "CONDUIRE" : "MARCHER"),
        (ke.querySelector(".player19-hint strong").textContent = m.record ? (U() ? "Voiture" : "Quad") : "Promenade"),
        (ke.querySelector(".player19-desktop").textContent = m.record
          ? "Z/S : avancer / reculer \xB7 Q/D : tourner \xB7 Maj : BOOST \xB7 Espace : frein \xB7 E : descendre"
          : "ZQSD : marcher \xB7 Maj : courir \xB7 Espace : sauter \xB7 E : monter"),
        (ke.querySelector(".player19-touch-note").textContent = m.record
          ? "Joystick : diriger \xB7 BOOST : jusqu\u2019\xE0 54 km/h \xB7 Frein"
          : "Joystick : marcher \xB7 Sauter \xB7 Glisser : regarder"));
    }
    function Vo(f) {
      var gt, Gt, Ot, Xt, Wt, i, d;
      if (!Ge.enabled || m.record || me) return !1;
      fn();
      const J = f || ((gt = m.near) == null ? void 0 : gt.id),
        Ze = $(J),
        Je = Ze ? st(Ze) : (Gt = n.props) == null ? void 0 : Gt.get(J);
      if (
        !Je ||
        !["quad", "car"].includes(Je.type) ||
        Math.hypot(Je.x - M.x, Je.z - M.z) > (Ze ? 3.2 : 2.8) * Math.max(0.75, Je.scale || 1) ||
        !Number.isFinite(Je.x) ||
        !Number.isFinite(Je.z) ||
        !Number.isFinite(Je.scale ?? 1) ||
        (Je.scale ?? 1) <= 0
      )
        return !1;
      ((m.previous = M.clone()),
        (m.record = { ...Je }),
        (m.scale = Je.scale || 1),
        (m.yaw = Number.isFinite(Je.rotation) ? Je.rotation : 0),
        (m.speed = m.steer = m.travel = m.distance = m.pitch = m.roll = 0),
        (ft = 0),
        (m.boost = !1),
        Ko(),
        Ze || (Xt = (Ot = n.props).setHidden) == null || Xt.call(Ot, Je.id, !0));
      const ct = It(Je.x, Je.z, m.yaw);
      if (!ct.ok)
        return (
          Ze || (i = (Wt = n.props).setHidden) == null || i.call(Wt, Je.id, !1),
          (m.record = null),
          fn("Ce v\xE9hicule doit \xEAtre plac\xE9 sur un espace d\xE9gag\xE9"),
          !1
        );
      (He(Je),
        (dn = null),
        M.set(Je.x, ct.height, Je.z),
        (m.visualY = ct.height),
        (at.grounded = !0),
        (at.verticalSpeed = 0),
        v.position.copy(M),
        (Ke.visible = !0),
        Ke.scale.setScalar(m.scale),
        Ke.rotation.set(0, m.yaw, 0),
        (m.pitch = ct.pitch || 0),
        (m.roll = ct.roll || 0),
        ve.rotation.set(m.pitch, 0, m.roll),
        Xe.rotation.set(0, 0, 0));
      for (const Z of qe)
        (Z.pivot.rotation.set(0, 0, 0), (Z.pivot.position.y = Z.restY ?? 0.33), Z.spin.rotation.set(0, 0, 0));
      return (
        ve.add(k),
        k.scale.setScalar(1 / m.scale),
        k.position.set(0, 0.94 - W / m.scale, -0.12),
        k.rotation.set(0, 0, 0),
        De.scale.set((U() ? 2.4 : 1.9) * m.scale, (U() ? 4.9 : 2.55) * m.scale, 1),
        (Ge.yaw = m.yaw + pe),
        (Ge.pitch = 0.62),
        (Ge.distance = 17),
        (Ie = ue = 0),
        m.transitions++,
        v.updateMatrixWorld(!0),
        mo(0),
        fn(),
        ia(0),
        v.updateMatrixWorld(!0),
        (d = n.audioEvents) == null || d.call(n, "quad-start", { id: Je.id }),
        n.markDirty(),
        !0
      );
    }
    function Mn() {
      if (!m.record) return;
      const f = {
        ...m.record,
        x: +M.x.toFixed(3),
        z: +M.z.toFixed(3),
        rotation: +Math.atan2(Math.sin(m.yaw), Math.cos(m.yaw)).toFixed(5),
        yOffset: 0,
      };
      U()
        ? n.onCarChange
          ? n.onCarChange(f)
          : Ro(f)
        : n.onVehicleChange
          ? n.onVehicleChange(f)
          : n.props.update(f.id, f);
    }
    function So(f = !1) {
      var Gt, Ot, Xt;
      if (!m.record || me) return !1;
      if (!f && Math.abs(m.speed) > 0.65) return (fn("Ralentir avant de descendre"), !1);
      let J = null;
      const Ze = [],
        Je = new t.Box3();
      v.updateMatrixWorld(!0);
      for (const Wt of [-1.04, 1.04])
        for (const i of U() ? [-2.23, 2.23] : [-1.1, 1.1]) Je.expandByPoint(Ke.localToWorld(new t.Vector3(Wt, 0, i)));
      Je.expandByScalar(0.38);
      for (const Wt of [1.55, 1.9, 2.45, 3.1])
        for (const i of [pe / 2, -pe / 2, pe, -pe * 0.75, pe * 0.75, 0])
          Ze.push([
            M.x + Math.sin(m.yaw + i) * (Wt * m.scale + 0.24),
            M.z + Math.cos(m.yaw + i) * (Wt * m.scale + 0.24),
          ]);
      for (const Wt of Ze) {
        if (Wt[0] > Je.min.x && Wt[0] < Je.max.x && Wt[1] > Je.min.z && Wt[1] < Je.max.z) continue;
        const i = zo(...Wt);
        if (i.ok && Math.abs(i.height - M.y) < 0.65) {
          J = [...Wt, i.height];
          break;
        }
      }
      if (!J && f && m.previous) {
        const Wt = zo(m.previous.x, m.previous.z);
        Wt.ok && (J = [m.previous.x, m.previous.z, Wt.height]);
      }
      if (!J && f)
        for (const Wt of [
          at.lastSafe,
          ...[
            [-5, 12],
            [-4, -19],
            [-1, -25],
          ].map((i) => ({ x: i[0], z: i[1] })),
        ]) {
          const i = zo(Wt.x, Wt.z);
          if (i.ok) {
            J = [Wt.x, Wt.z, i.height];
            break;
          }
        }
      if (!J) return (fn("Avancer vers un endroit plus d\xE9gag\xE9"), !1);
      const ct = m.record.id,
        gt = $(ct);
      me = !0;
      try {
        (Mn(), gt || (Ot = (Gt = n.props).setHidden) == null || Ot.call(Gt, ct, !1));
      } finally {
        me = !1;
      }
      return (
        gt &&
          (gt.rig.parent.add(gt.rig.root),
          gt.rig.root.position.set(M.x, M.y, M.z),
          gt.rig.root.rotation.set(0, m.yaw, 0)),
        (m.record = null),
        (dn = null),
        (m.speed = m.steer = m.distance = m.pitch = m.roll = 0),
        (m.boost = !1),
        (ft = 0),
        m.transitions++,
        (Ke.visible = !1),
        gt || ve.rotation.set(0, 0, 0),
        Xe.rotation.set(0, 0, 0),
        v.add(k),
        He(null),
        k.scale.setScalar(1),
        k.position.set(0, 0, 0),
        k.rotation.set(0, m.yaw, 0),
        De.scale.set(1, 0.68, 1),
        M.set(J[0], J[2], J[1]),
        v.position.copy(M),
        (Y = m.yaw),
        (Ie = ue = N = 0),
        (at.grounded = !0),
        (at.verticalSpeed = at.airTime = 0),
        at.lastSafe.copy(M),
        Ko(),
        jo(),
        fn(),
        v.updateMatrixWorld(!0),
        _o(0, 0),
        v.updateMatrixWorld(!0),
        (Xt = n.audioEvents) == null || Xt.call(n, "quad-stop", { id: ct }),
        n.markDirty(),
        !0
      );
    }
    function ia(f) {
      if (H) {
        (k.position.set(U() ? -0.38 : 0, (U() ? 0.63 : 0.94) - W / m.scale, U() ? -0.17 : -0.12),
          k.rotation.set(0, 0, 0),
          (Ke.rotation.y = m.yaw),
          (Xe.rotation.y = m.steer),
          v.updateMatrixWorld(!0),
          H.update(f, {
            speed: ft,
            distance: m.distance,
            running: !1,
            grounded: !0,
            verticalSpeed: 0,
            riding: !0,
            steering: m.steer,
            quadScale: m.scale,
            carDriving: U(),
            ...Bt(),
          }));
        return;
      }
      const J = m.scale;
      (k.position.set(U() ? -0.38 : 0, (U() ? 0.63 : 0.94) - W / J, U() ? -0.17 : -0.12),
        k.rotation.set(0, 0, 0),
        z.rotation.set(0.3, 0, -m.steer * 0.022),
        (Me.rotation.y = 0),
        (V.rotation.y = m.steer * 0.08),
        (Ke.rotation.y = m.yaw),
        (Xe.rotation.y = m.steer),
        v.updateMatrixWorld(!0));
      for (let Ze = 0; Ze < 2; Ze++) {
        const Je = Ze ? 1 : -1,
          ct = lt[Ze],
          gt = z.worldToLocal(Xe.localToWorld(new t.Vector3(Je * 0.36, 0, 0))).sub(ct.position),
          Gt = Math.hypot(gt.x, gt.z);
        ((ct.rotation.y = Math.atan2(gt.x, gt.z)),
          (ct.rotation.z = 0),
          To(ct, ct.userData.elbow, Gt, -gt.y, 0.263, 0.25, !1),
          (ct.userData.wrist.rotation.x = 0.05));
        const Ot = je[Ze],
          Xt = k.worldToLocal(ve.localToWorld(new t.Vector3(Je * 0.39, 0.41, 0.15))).sub(Ot.position);
        ((Ot.rotation.y = Math.atan2(Xt.x, Xt.z)),
          (Ot.rotation.z = 0),
          To(Ot, Ot.userData.knee, Math.hypot(Xt.x, Xt.z), -Xt.y, 0.355, 0.35, !0),
          Ot.userData.foot.rotation.set(-Ot.rotation.x - Ot.userData.knee.rotation.x, -Ot.rotation.y, 0));
      }
    }
    function on() {
      return Mt.map((f) => ({ id: f.id, x: f.spec.position[0], z: f.spec.position[1], rotation: f.spec.angle || 0 }));
    }
    function Ro(f) {
      var Ze;
      const J = $(f == null ? void 0 : f.id);
      if (!J || !Number.isFinite(f.x) || !Number.isFinite(f.z) || !Number.isFinite(f.rotation)) return !1;
      if (
        ((J.spec.position[0] = f.x),
        (J.spec.position[1] = f.z),
        (J.spec.angle = f.rotation),
        ((Ze = m.record) == null ? void 0 : Ze.id) !== J.id)
      ) {
        (J.rig.root.position.set(f.x, po(f.x, f.z), f.z), J.rig.root.rotation.set(0, f.rotation, 0));
        const Je = Math.sin(f.rotation),
          ct = Math.cos(f.rotation),
          gt = po(f.x + Je * 1.27, f.z + ct * 1.27),
          Gt = po(f.x - Je * 1.3, f.z - ct * 1.3),
          Ot = po(f.x - ct * 0.84, f.z + Je * 0.84),
          Xt = po(f.x + ct * 0.84, f.z - Je * 0.84),
          Wt = (Xt - Ot) / 1.68,
          i = (gt - Gt) / 2.57;
        J.rig.frame.rotation.set(-Math.atan(i), 0, Math.asin(_e(Wt / Math.hypot(Wt, 1, i), -1, 1)));
      }
      return (n.markDirty(), !0);
    }
    function cn(f) {
      for (const J of Mt) {
        const Ze = f.find((Je) => Je.id === J.id);
        Ro(Ze || { id: J.id, ...J.initial });
      }
      return !0;
    }
    // V32 : traces de pneus nettes. Chaque empreinte assombrit le sol par multiplication
    // (herbe couchee, puis boue sous la pluie, ornieres sombres dans la neige), avec le
    // dessin des crampons. Horloge reelle, quel que soit le mode de vue : l'herbe se
    // redresse en 2 a 3 minutes, la boue seche en 6 minutes, la neige recouvre en 4.
    const Io = typeof matchMedia == "function" && matchMedia("(pointer:coarse)").matches ? 1100 : 2400,
      Dn = 360,
      wn = { value: 0 },
      No = new t.PlaneGeometry(1, 1);
    No.rotateX(-pe / 2);
    const rn = new t.InstancedBufferAttribute(new Float32Array(Io).fill(-1e3), 1),
      tireGrip32 = new t.InstancedBufferAttribute(new Float32Array(Io).fill(1), 1);
    (No.setAttribute("tireBorn24", rn), No.setAttribute("tireGrip32", tireGrip32));
    const tireWeather32 = () => {
        var f, J;
        return ((J = (f = n.weather) == null ? void 0 : f.call(n)) == null ? void 0 : J.uniforms) || {};
      },
      Bn = new t.ShaderMaterial({
        transparent: !0,
        depthWrite: !1,
        polygonOffset: !0,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
        blending: t.CustomBlending,
        blendEquation: t.AddEquation,
        blendSrc: t.ZeroFactor,
        blendDst: t.SrcColorFactor,
        uniforms: { uTireTime24: wn, uTireWet32: { value: 0 }, uTireSnow32: { value: 0 } },
        vertexShader:
          "attribute float tireBorn24,tireGrip32;uniform float uTireTime24;varying float vTireAge24,vTireGrip32;varying vec2 vTireUv24;varying vec3 vTireWorld32;void main(){vTireAge24=uTireTime24-tireBorn24;vTireGrip32=tireGrip32;vTireUv24=uv;vec4 w=modelMatrix*instanceMatrix*vec4(position,1.);vTireWorld32=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}",
        fragmentShader:
          "uniform float uTireWet32,uTireSnow32;varying float vTireAge24,vTireGrip32;varying vec2 vTireUv24;varying vec3 vTireWorld32;float tireHash32(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}void main(){if(vTireAge24<0.)discard;float life=mix(mix(150.,360.,uTireWet32),240.,uTireSnow32);float fresh=1.-smoothstep(life*.25,life,vTireAge24);fresh*=fresh;float edge=smoothstep(0.,.2,vTireUv24.x)*(1.-smoothstep(.8,1.,vTireUv24.x));float chevron=fract(vTireUv24.y*6.+abs(vTireUv24.x-.5)*1.4);float lug=smoothstep(.3,.42,chevron)*(1.-smoothstep(.7,.82,chevron));float grain=.82+.18*tireHash32(floor(vTireWorld32.xz*16.));float crush=edge*(.62+.38*lug)*grain;vec3 tint=mix(vec3(.57,.64,.49),vec3(.45,.39,.32),uTireWet32);tint=mix(tint,vec3(.6,.62,.68),uTireSnow32);float amount=crush*fresh*vTireGrip32*mix(.8,1.,uTireWet32);gl_FragColor=vec4(mix(vec3(1.),tint,amount),1.);}",
      });
    ((Bn.name = "Traces_de_pneus_v32"),
      (Bn.onBeforeRender = () => {
        const f = tireWeather32();
        ((wn.value = performance.now() / 1e3),
          (Bn.uniforms.uTireWet32.value = f.wet ? f.wet.value : 0),
          (Bn.uniforms.uTireSnow32.value = f.snow ? f.snow.value : 0));
      }));
    const mn = new t.InstancedMesh(No, Bn, Io);
    ((mn.name = "Traces_de_pneus_du_quad"),
      (mn.userData.exportSkip = !0),
      (mn.userData.noWeatherPaint22 = !0),
      (mn.frustumCulled = !1),
      (mn.renderOrder = 2),
      (mn.onBeforeRender = Bn.onBeforeRender),
      R.add(mn));
    const Hn = new t.Matrix4(),
      sn = new t.Vector3(),
      Qo = new t.Vector3(0.27, 1, 0.42),
      un = new t.Quaternion(),
      Go = new t.Vector3(),
      kn = new t.Quaternion(),
      xn = new t.Vector3(0, 1, 0);
    let hn = 0,
      Gn = 0,
      dn = null;
    Hn.makeScale(0, 0, 0);
    for (let f = 0; f < Io; f++) mn.setMatrixAt(f, Hn);
    function _n(f, J) {
      var Je;
      const Ze = (Je = jt.supportHeight) == null ? void 0 : Je.call(jt, f, J);
      return Math.max(T(f, J), Number.isFinite(Ze) ? Ze : -1 / 0);
    }
    function zn(f, J, Ze, length32 = 0.42, grip32 = 1) {
      if (ao(f, J) || uo(f, J)) return;
      const Je = _n(f, J),
        ground32 = T(f, J),
        ct = (_n(f + 0.12, J) - _n(f - 0.12, J)) / 0.24,
        gt = (_n(f, J + 0.12) - _n(f, J - 0.12)) / 0.24;
      // Pas de traces sur les dalles, marches et murets (support au-dessus du terrain).
      !Number.isFinite(Je) ||
        Je - ground32 > 0.06 ||
        Math.hypot(ct, gt) > 2 ||
        (sn.set(f, Je + 0.03, J),
        Go.set(-ct, 1, -gt).normalize(),
        un.setFromUnitVectors(xn, Go),
        kn.setFromAxisAngle(xn, Ze),
        un.multiply(kn),
        Qo.set(0.27, 1, length32),
        Hn.compose(sn, un, Qo),
        mn.setMatrixAt(hn, Hn),
        rn.setX(hn, wn.value),
        tireGrip32.setX(hn, grip32),
        (hn = (hn + 1) % Io),
        Gn++);
    }
    function An() {
      if (ft < 0.15) {
        dn = null;
        return;
      }
      const f = eo.filter((Ze, Je) => !qe[Je].front && Ze.grounded);
      if (f.length !== 2) {
        dn = null;
        return;
      }
      if (!dn) {
        dn = f.map((Ze) => ({ x: Ze.x, z: Ze.z }));
        return;
      }
      let J = !1;
      // Plus on va vite, plus l'herbe est arrachee (et l'accelerateur creuse davantage).
      const grip32 = _e(0.72 + Math.abs(m.speed) * 0.025 + (m.boost ? 0.15 : 0), 0.72, 1);
      for (let Ze = 0; Ze < f.length; Ze++) {
        const Je = dn[Ze],
          ct = f[Ze],
          gt = Math.hypot(ct.x - Je.x, ct.z - Je.z);
        if (gt < 0.34) continue;
        if (gt < 3) {
          const Gt = Math.min(8, Math.ceil(gt / 0.36)),
            heading32 = Math.atan2(ct.x - Je.x, ct.z - Je.z);
          for (let Ot = 1; Ot <= Gt; Ot++) {
            const Xt = (Ot - 0.5) / Gt;
            (zn(Je.x + (ct.x - Je.x) * Xt, Je.z + (ct.z - Je.z) * Xt, heading32, gt / Gt + 0.07, grip32), (J = !0));
          }
        }
        dn[Ze] = { x: ct.x, z: ct.z };
      }
      J && ((mn.instanceMatrix.needsUpdate = !0), (rn.needsUpdate = !0), (tireGrip32.needsUpdate = !0));
    }
    function Xn(f) {
      var J, Ze;
      return (
        /INPUT|TEXTAREA|SELECT/.test((J = f.target) == null ? void 0 : J.tagName) ||
        ((Ze = f.target) == null ? void 0 : Ze.isContentEditable)
      );
    }
    (document.addEventListener("keydown", (f) => {
      if (!Ge.enabled || Xn(f) || f.ctrlKey || f.metaKey || f.altKey) return;
      const J = f.key.toLowerCase();
      if (J === " " && !m.record) {
        (f.preventDefault(), f.repeat || Oe());
        return;
      }
      if (J === "e" && !f.repeat) {
        (f.preventDefault(), m.record ? So() : Vo());
        return;
      }
      [" ", "z", "q", "s", "d", "w", "a", "arrowup", "arrowdown", "arrowleft", "arrowright", "shift"].includes(J) &&
        (f.preventDefault(), kt.add(J), n.markDirty());
    }),
      document.addEventListener("keyup", (f) => kt.delete(f.key.toLowerCase())),
      window.addEventListener("blur", () => {
        (Ko(), m.record && (m.speed = 0));
      }),
      document.addEventListener("visibilitychange", () => {
        document.hidden && (Ko(), m.record && (m.speed = 0));
      }),
      a.addEventListener(
        "pointerdown",
        (f) => {
          var J;
          !Ge.enabled ||
            ne !== null ||
            (f.pointerType !== "touch" && f.button !== 0 && f.button !== 2) ||
            (f.preventDefault(),
            a.focus({ preventScroll: !0 }),
            (ne = f.pointerId),
            (K = { x: f.clientX, y: f.clientY }),
            (J = a.setPointerCapture) == null || J.call(a, f.pointerId));
        },
        !0,
      ),
      a.addEventListener("pointermove", (f) => {
        !Ge.enabled ||
          f.pointerId !== ne ||
          !K ||
          (f.preventDefault(),
          (Ge.yaw -= (f.clientX - K.x) * 0.006),
          (Ge.pitch = _e(Ge.pitch + (f.clientY - K.y) * 0.004, 0.38, 1.18)),
          (K = { x: f.clientX, y: f.clientY }),
          n.markDirty());
      }));
    function Fn(f) {
      f.pointerId === ne && ((ne = null), (K = null));
    }
    for (const f of ["pointerup", "pointercancel", "lostpointercapture"]) a.addEventListener(f, Fn);
    (a.addEventListener("contextmenu", (f) => {
      Ge.enabled && f.preventDefault();
    }),
      a.addEventListener(
        "wheel",
        (f) => {
          Ge.enabled && (f.preventDefault(), (Ge.distance = _e(Ge.distance + f.deltaY * 0.014, 7, 29)), n.markDirty());
        },
        { passive: !1 },
      ));
    function nn(f) {
      const J = rt.getBoundingClientRect(),
        Ze = J.left + J.width / 2,
        Je = J.top + J.height / 2,
        ct = J.width * 0.3,
        gt = f.clientX - Ze,
        Gt = f.clientY - Je,
        Ot = Math.hypot(gt, Gt),
        Xt = Ot > ct ? ct / Ot : 1;
      (($e.style.transform = `translate(calc(-50% + ${gt * Xt}px),calc(-50% + ${Gt * Xt}px))`),
        ln((-Gt * Xt) / ct, (gt * Xt) / ct));
    }
    (rt.addEventListener("pointerdown", (f) => {
      !Ge.enabled ||
        be !== null ||
        (f.preventDefault(), f.stopPropagation(), (be = f.pointerId), rt.setPointerCapture(f.pointerId), nn(f));
    }),
      rt.addEventListener("pointermove", (f) => {
        f.pointerId === be && (f.preventDefault(), nn(f));
      }));
    function gn(f) {
      f.pointerId === be && ((be = null), ln(0, 0), ($e.style.transform = "translate(-50%,-50%)"));
    }
    for (const f of ["pointerup", "pointercancel", "lostpointercapture"]) rt.addEventListener(f, gn);
    B.addEventListener("pointerdown", (f) => {
      Ge.enabled &&
        (f.preventDefault(),
        f.stopPropagation(),
        (fe = f.pointerId),
        B.setPointerCapture(f.pointerId),
        (Ge.running = !0),
        B.classList.add("is-held"));
    });
    function ea(f) {
      f.pointerId === fe && ((fe = null), (Ge.running = !1), B.classList.remove("is-held"));
    }
    for (const f of ["pointerup", "pointercancel", "lostpointercapture"]) B.addEventListener(f, ea);
    for (const f of ke.querySelectorAll("[data-player19-zoom]"))
      f.addEventListener("click", () => {
        ((Ge.distance = _e(Ge.distance + Number(f.dataset.player19Zoom) * 2, 7, 29)), n.markDirty());
      });
    G.addEventListener("pointerdown", (f) => {
      m.record &&
        (f.preventDefault(),
        f.stopPropagation(),
        (Qe = f.pointerId),
        G.setPointerCapture(f.pointerId),
        kt.add(" "),
        G.classList.add("is-held"));
    });
    for (const f of ["pointerup", "pointercancel", "lostpointercapture"])
      G.addEventListener(f, (J) => {
        J.pointerId === Qe && ((Qe = null), kt.delete(" "), G.classList.remove("is-held"));
      });
    Le.addEventListener("pointerdown", (f) => {
      (f.preventDefault(), f.stopPropagation(), Oe());
    });
    function Sn(f) {
      ((Ge.boost = !!f), pt.classList.toggle("is-held", Ge.boost), n.markDirty());
    }
    pt.addEventListener("pointerdown", (f) => {
      var J;
      m.record &&
        (f.preventDefault(),
        f.stopPropagation(),
        (Fe = f.pointerId),
        (J = pt.setPointerCapture) == null || J.call(pt, f.pointerId),
        Sn(!0));
    });
    for (const f of ["pointerup", "pointercancel", "lostpointercapture"])
      pt.addEventListener(f, (J) => {
        J.pointerId === Fe && ((Fe = null), Sn(!1));
      });
    if (
      (ke.querySelector(".player19-centre").addEventListener("click", jo),
      F.addEventListener("click", () => (m.record ? So() : Vo())),
      n.props)
    ) {
      const f = jt.entryQuad || { x: 4.5, z: -17.8, rotation: -pe / 2 },
        J = n.props.records.find(
          (Ze) => Ze.type === "quad" && Ze.label === "Quad du moulin" && Math.hypot(Ze.x - 4.5, Ze.z + 17.8) < 0.25,
        );
      (J && jt.entryQuad && n.props.update(J.id, { ...J, x: f.x, z: f.z, rotation: f.rotation, yOffset: 0 }),
        n.props.records.some((Ze) => Ze.type === "quad") ||
          n.props.add({ type: "quad", ...f, scale: 1, yOffset: 0, variant: 0, label: "Quad du moulin" }));
    }
    function Jo() {
      var f, J, Ze;
      return {
        riding: !!m.record,
        type: ((f = m.record) == null ? void 0 : f.type) || null,
        id: ((J = m.record) == null ? void 0 : J.id) || null,
        nearbyId: ((Ze = m.near) == null ? void 0 : Ze.id) || null,
        speed: m.speed,
        maxSpeed: U() ? 16 : 15,
        boost: m.boost,
        pitch: m.pitch,
        roll: m.roll,
        yaw: m.yaw,
        steering: m.steer,
        scale: m.scale,
        transitions: m.transitions,
        chassisPitch: ve.rotation.x,
        chassisRoll: ve.rotation.z,
        position: { x: M.x, y: M.y, z: M.z },
        wheelContacts: eo.map((Je) => ({ ...Je })),
        wheelParents: qe.every((Je) => Je.pivot.parent === ve),
      };
    }
    function Cn() {
      var Ze, Je, ct, gt;
      const f = m.record ? m.yaw : Y,
        J = uo(M.x, M.z)
          ? "wood"
          : ((Ze = n.surfaceType) == null ? void 0 : Ze.call(n, M.x, M.z)) ||
            (M.x > -27 && M.x < 9 && M.z > -27 && M.z < 18 ? "stone" : "grass");
      return {
        enabled: Ge.enabled,
        heading: f,
        facing: f,
        forward: { x: Math.sin(f), y: 0, z: Math.cos(f) },
        ...Bt(),
        position: { x: M.x, y: M.y, z: M.z },
        moving: ft > 0.12,
        speed: ft,
        running: !m.record && ue > 0.35,
        surface: J,
        vehicle: ((Je = m.record) == null ? void 0 : Je.type) || null,
        rpm: m.record ? _e(0.14 + Math.abs(m.speed) / 17 + (Ge.forward > 0 ? 0.1 : 0) + (m.boost ? 0.12 : 0), 0, 1) : 0,
        boost: m.boost,
        wheelContacts: m.record ? eo.map((Gt) => ({ ...Gt })) : [],
        outfit: ((ct = H == null ? void 0 : H.getState) == null ? void 0 : ct.call(H).outfit) || "mild",
        grounded: !!m.record || at.grounded,
        verticalSpeed: at.verticalSpeed,
        stepPhase: ((gt = H == null ? void 0 : H.getState) == null ? void 0 : gt.call(H).stepPhase) ?? N,
      };
    }
    function Zn() {
      if (!Ge.enabled) return { enabled: !1, riding: !1, head: null, headlights: [], heading: Y };
      v.updateMatrixWorld(!0);
      const f = m.record
        ? (U() ? [-0.61, 0.61] : [-0.31, 0.31]).map((J) =>
            ve.localToWorld(new t.Vector3(J, U() ? 0.7 : 0.722, U() ? 2.15 : 0.995)),
          )
        : [];
      return {
        enabled: Ge.enabled,
        riding: !!m.record,
        head: k.localToWorld(new t.Vector3(0, 1.63, 0.13)),
        headlights: f,
        heading: m.record ? m.yaw : Y,
      };
    }
    return {
      group: v,
      position: M,
      physics: at,
      requestJump: Oe,
      setBoost: Sn,
      surfaceInfo: io,
      bridges: I,
      avatar: H,
      getPhysicsState: () => {
        var f;
        return {
          grounded: at.grounded,
          verticalSpeed: at.verticalSpeed,
          airTime: at.airTime,
          jumps: at.jumps,
          landings: at.landings,
          waterRecoveries: at.waterRecoveries,
          maxJumpHeight: (at.jumpSpeed * at.jumpSpeed) / (2 * at.gravity),
          bridge: ((f = uo(M.x, M.z)) == null ? void 0 : f.name) || null,
          source: H ? "imported" : "fallback",
        };
      },
      get enabled() {
        return Ge.enabled;
      },
      setEnabled: tn,
      tick: Do,
      teleport: ho,
      goToEntrance: Xo,
      setInput: ln,
      resetInput: Ko,
      canStand: zo,
      moveWorld: Q,
      bridgeAt: uo,
      surface: po,
      canDrive: It,
      getVehicleState: Jo,
      mountVehicle: Vo,
      dismountVehicle: So,
      exportParking24: on,
      importParking24: cn,
      setParkedCar24: Ro,
      getTireTracks24: () => ({
        capacity: Io,
        total: Gn,
        active: rn.array.filter((f) => wn.value - f < Dn && f >= 0).length,
      }),
      // V32 : trace une empreinte (essais, démonstrations). heading en radians.
      stampTrack32: (f, J, Ze, Je = 0.42, ct = 1) => {
        (zn(f, J, Ze, Je, ct), (mn.instanceMatrix.needsUpdate = !0), (rn.needsUpdate = !0), (tireGrip32.needsUpdate = !0));
      },
      getAudioState: Cn,
      getLightAnchors: Zn,
      getLightMounts: Zn,
      get vehicleChassis() {
        return ve;
      },
      physicalBuildings: Dt,
      solidRects: we,
      vehicleRoot: Ke,
      actor: k,
      pose: { legs: je, arms: lt, torso: z, head: V },
      getState: () => ({
        enabled: Ge.enabled,
        x: M.x,
        y: M.y,
        z: M.z,
        forward: Ge.forward,
        right: Ge.right,
        running: Ge.running || kt.has("shift"),
        grounded: at.grounded,
        verticalSpeed: at.verticalSpeed,
        boost: m.boost,
        blocked: Ge.blocked,
        yaw: Ge.yaw,
        pitch: Ge.pitch,
        distance: Ge.distance,
      }),
      recenter: jo,
    };
  }),
  (globalThis.MoulinShell19 = function (t) {
    "use strict";
    const { root: n, mount: A, markDirty: re } = t,
      R = (ce) => n.querySelector(ce),
      he = [],
      te = (ce, V, Me, je) => {
        ce && (ce.addEventListener(V, Me, je), he.push(() => ce.removeEventListener(V, Me, je)));
      },
      O = R("[data-settings-panel]"),
      T = R("[data-ui-settings]"),
      le = R("[data-fullscreen]"),
      X = R("[data-editor-collapse]"),
      a = R("[data-shell-status]");
    let _e = 0,
      pe = 0,
      q = !1;
    const v = R("[data-mode-trigger31]"),
      k = R(".mode-switch"),
      h = { orbit: "Vue 3D", fly: "Vue libre", editor: "Am\xE9nager", play: "Personnage", globe: "M\xE9t\xE9o" };
    function b(ce, V = !1) {
      var Me;
      ((n.dataset.modeMenuOpen = String(!!ce)),
        v == null || v.setAttribute("aria-expanded", String(!!ce)),
        ce && (x(!1), V && ((Me = k.querySelector("[aria-pressed=true]")) == null || Me.focus({ preventScroll: !0 }))));
    }
    function p() {
      var lt;
      const ce = n.dataset.mode || "orbit",
        V = k.querySelector('[data-mode="' + ce + '"]'),
        Me = v == null ? void 0 : v.querySelector("[data-mode-icon31]");
      Me &&
        (Me.innerHTML =
          ((lt = V == null ? void 0 : V.querySelector(".game22-mode-icon")) == null ? void 0 : lt.innerHTML) || "");
      const je = v == null ? void 0 : v.querySelector("[data-mode-label31]");
      (je && (je.textContent = h[ce] || "Vue 3D"),
        v == null || v.setAttribute("aria-label", "Changer de vue, mode actuel : " + (h[ce] || "Vue 3D")));
    }
    n.classList.add("game19");
    function S(ce) {
      a && (clearTimeout(_e), (a.textContent = ce), (a.hidden = !1), (_e = setTimeout(() => (a.hidden = !0), 5500)));
    }
    function x(ce) {
      var V;
      (ce && b(!1),
        (O.hidden = !ce),
        T == null || T.setAttribute("aria-expanded", String(ce)),
        ce && document.pointerLockElement && ((V = document.exitPointerLock) == null || V.call(document)));
    }
    function c(ce) {
      ((n.dataset.editorCollapsed = String(!!ce)), X == null || X.setAttribute("aria-expanded", String(!ce)));
      const V = R("[data-editor-collapse-label]");
      (V && (V.textContent = ce ? "Afficher les outils" : "Masquer les outils"), re == null || re());
    }
    function P() {
      (cancelAnimationFrame(pe),
        (pe = requestAnimationFrame(() => {
          if (q) return;
          const ce = window.visualViewport,
            V = ce ? Math.round(ce.height) : window.innerHeight;
          (document.documentElement.style.setProperty("--game19-height", V + "px"), re == null || re());
        })));
    }
    function C() {
      const ce = !!(document.fullscreenElement || document.webkitFullscreenElement);
      ((n.dataset.nativeFullscreen = String(ce)),
        le == null || le.setAttribute("aria-pressed", String(ce)),
        le == null || le.setAttribute("title", ce ? "Quitter le plein \xE9cran" : "Afficher en plein \xE9cran"));
      const V = R("[data-fullscreen-label]");
      (V && (V.textContent = ce ? "R\xE9duire" : "Plein \xE9cran"), P());
    }
    async function Ne() {
      x(!1);
      try {
        if (document.fullscreenElement || document.webkitFullscreenElement) {
          const ce = document.exitFullscreen || document.webkitExitFullscreen;
          ce && (await ce.call(document));
        } else {
          const ce = n.requestFullscreen || n.webkitRequestFullscreen;
          ce
            ? await ce.call(n)
            : S(
                "La vue occupe toute la fen\xEAtre. Ce navigateur ne permet pas de masquer ses barres automatiquement.",
              );
        }
      } catch {
        S("La vue reste en pleine fen\xEAtre. Le plein \xE9cran natif n\u2019est pas disponible ici.");
      }
      C();
    }
    (te(v, "click", () => b(n.dataset.modeMenuOpen !== "true")),
      te(v, "keydown", (ce) => {
        ce.key === "ArrowDown" && (ce.preventDefault(), b(!0, !0));
      }),
      te(k, "click", (ce) => {
        ce.target.closest("button[data-mode]") && (b(!1), p(), v == null || v.focus({ preventScroll: !0 }));
      }),
      te(n, "keydown", (ce) => {
        var V;
        if (n.dataset.modeMenuOpen === "true") {
          if (ce.key === "Escape")
            (ce.preventDefault(), ce.stopPropagation(), b(!1), v == null || v.focus({ preventScroll: !0 }));
          else if (["ArrowDown", "ArrowUp"].includes(ce.key) && k.contains(ce.target)) {
            ce.preventDefault();
            const Me = [...k.querySelectorAll("button[data-mode]")],
              je = Me.indexOf(document.activeElement),
              lt = (je + (ce.key === "ArrowDown" ? 1 : -1) + Me.length) % Me.length;
            (V = Me[lt]) == null || V.focus({ preventScroll: !0 });
          }
        }
      }),
      te(n, "pointerdown", (ce) => {
        n.dataset.modeMenuOpen === "true" && !k.contains(ce.target) && !(v != null && v.contains(ce.target)) && b(!1);
      }),
      te(T, "click", () => x(O.hidden)),
      te(R("[data-settings-close]"), "click", () => {
        (x(!1), T == null || T.focus({ preventScroll: !0 }));
      }),
      te(le, "click", Ne),
      te(X, "click", () => c(n.dataset.editorCollapsed !== "true")),
      te(n, "pointerdown", (ce) => {
        !O.hidden && !O.contains(ce.target) && !(T != null && T.contains(ce.target)) && x(!1);
      }),
      te(document, "keydown", (ce) => {
        ce.key === "Escape" && !O.hidden && x(!1);
      }),
      te(document, "fullscreenchange", C),
      te(document, "webkitfullscreenchange", C),
      te(window, "resize", P),
      te(window, "orientationchange", P),
      te(window.visualViewport, "resize", P));
    const z = new MutationObserver((ce) => {
      ce.some((V) => V.attributeName === "data-mode") && (b(!1), p(), x(!1), n.dataset.mode === "editor" && c(!1));
    });
    return (
      z.observe(n, { attributes: !0, attributeFilter: ["data-mode"] }),
      c(!1),
      x(!1),
      b(!1),
      p(),
      C(),
      {
        setCollapsed: c,
        setSettings: x,
        fullscreen: Ne,
        announce: S,
        updateViewport: P,
        destroy() {
          ((q = !0), z.disconnect(), he.forEach((ce) => ce()), clearTimeout(_e), cancelAnimationFrame(pe));
        },
      }
    );
  }),
  (function () {
    const t = document.getElementById("moulin-vallee-3d"),
      n = t.querySelector("[data-loading]"),
      A = matchMedia("(pointer: coarse)").matches || innerWidth < 700,
      re = { mobile: A, started: performance.now(), stages: [], done: !1, error: null, yields26: 0 };
    function R(he) {
      re.error ||
        ((re.error = String((he == null ? void 0 : he.message) || he)),
        (n.hidden = !1),
        n.setAttribute("role", "alert"),
        (n.querySelector("strong").textContent = "La 3D n\u2019a pas pu d\xE9marrer"),
        (n.querySelector("[data-load-detail]").textContent = re.error),
        (n.querySelector("[data-load-help]").textContent =
          "Ouvre l\u2019adresse HTTPS du site dans Safari ou Chrome, puis recharge. Ferme les autres onglets 3D si la m\xE9moire du t\xE9l\xE9phone est limit\xE9e."),
        (n.querySelector("[data-retry]").hidden = !1));
    }
    (n.querySelector("[data-retry]").addEventListener("click", () => location.reload()),
      (globalThis.MoulinBoot = {
        ...re,
        state: re,
        mobile: A,
        async yield() {
          var he;
          (re.yields26++,
            (he = globalThis.scheduler) != null && he.yield
              ? await globalThis.scheduler.yield()
              : await new Promise((te) => setTimeout(te, 0)));
        },
        async step(he) {
          ((n.querySelector("strong").textContent = he),
            (n.querySelector("[data-load-detail]").textContent = A
              ? "Rendu adapt\xE9 au t\xE9l\xE9phone"
              : "Pr\xE9paration de la maquette"),
            re.stages.push({ label: he, at: performance.now() - re.started }),
            await new Promise((te) => setTimeout(te, 24)));
        },
        fail: R,
        finish() {
          ((re.done = !0), (re.duration = performance.now() - re.started), (n.hidden = !0));
        },
      }),
      window.addEventListener("error", (he) => {
        re.done || R(he.error || he.message);
      }),
      window.addEventListener("unhandledrejection", (he) => {
        re.done || R(he.reason);
      }),
      setTimeout(() => {
        !re.done &&
          !re.error &&
          (n.querySelector("[data-load-help]").textContent =
            "Le calcul prend plus de temps que pr\xE9vu. Vous pouvez recharger la page si le navigateur a suspendu le chargement.");
      }, 3e4));
  })(),
  (globalThis.MoulinTerrainCache = () => globalThis.MoulinHost30.terrain),
  (globalThis.MoulinFinish18 = function (t, { model: n, surfaces: A, materials: re, forest: R }) {
    var q, v, k, h;
    const he = new Map(),
      te = (b, p) => {
        b && !b.transparent && he.set(b, p);
      };
    n.traverse((b) => {
      for (const p of Array.isArray(b.material) ? b.material : [b.material])
        !p ||
          (!p.isMeshStandardMaterial && !p.isMeshLambertMaterial) ||
          (p.map === A.grass
            ? te(p, 1)
            : p.map === A.stone || p.map === A.assetRock
              ? te(p, 3)
              : p.map === A.wood && te(p, 4),
          /Rochers_de_berge|Pierres_et_lichens|Rocaille/.test(b.name) && te(p, 3),
          /Volume_du_massif_de_rhododendrons|Bouquets_de_camelia/.test(b.name) && te(p, 2));
    });
    for (const b of [re.foliage, re.canopy]) te(b, 2);
    (te(R.materials[2], 2), te(R.materials[0], 4), te(R.materials[1], 5));
    for (const [b, p] of he) {
      (p === 1 && ((b.normalMap = A.grassNormal), (q = b.normalScale) == null || q.set(0.25, 0.25), (b.roughness = 1)),
        p === 3 &&
          b.map &&
          ((b.normalMap = A.stoneNormal),
          (v = b.normalScale) == null || v.set(0.25, 0.25),
          (b.roughness = 1),
          (b.metalness = 0),
          (b.metalnessMap = null)),
        p === 4 &&
          b.map &&
          ((b.normalMap = A.woodNormal), (k = b.normalScale) == null || k.set(0.32, 0.32), (b.roughness = 0.96)));
      const S = b.onBeforeCompile,
        x = ((h = b.customProgramCacheKey) == null ? void 0 : h.call(b).toString()) || "";
      ((b.onBeforeCompile = (c) => {
        (S == null || S(c),
          (c.uniforms.finishMap = { value: A.finishDetail }),
          (c.vertexShader =
            `varying vec3 finishWorld,finishNormal;
` + c.vertexShader),
          (c.vertexShader = c.vertexShader.replace(
            "#include <project_vertex>",
            `#include <project_vertex>
    vec4 finishPosition=vec4(transformed,1.0);
    #ifdef USE_INSTANCING
     finishPosition=instanceMatrix*finishPosition;
    #endif
    finishWorld=(modelMatrix*finishPosition).xyz;
    finishNormal=inverseTransformDirection(transformedNormal,viewMatrix);`,
          )),
          (c.fragmentShader =
            `uniform sampler2D finishMap;varying vec3 finishWorld,finishNormal;
` + c.fragmentShader));
        let P = "";
        (p === 1 &&
          (P = `
    vec3 grain=texture2D(finishMap,finishWorld.xz*.16).rgb;
    float lawnWear=texture2D(finishMap,finishWorld.xz*.023).g;
    diffuseColor.rgb*=.90+.14*grain.b;
    diffuseColor.rgb*=mix(vec3(.86,1.015,.87),vec3(1.04,1.025,.91),smoothstep(.23,.79,lawnWear));`),
          p === 2 &&
            (P = `
    vec3 leafAxis=abs(finishNormal);
    vec2 leafUv=leafAxis.y>max(leafAxis.x,leafAxis.z)?finishWorld.xz:(leafAxis.x>leafAxis.z?finishWorld.yz:finishWorld.xy);
    vec3 leaf=texture2D(finishMap,leafUv*.39).rgb;
    float upper=smoothstep(-.35,.72,normalize(finishNormal).y);
    diffuseColor.rgb*=mix(.83,1.06,upper)*(.89+.22*leaf.r);
    diffuseColor.rgb*=mix(vec3(.88,1.0,.91),vec3(1.07,1.035,.84),upper*.6);`),
          p === 3 &&
            (P = `
    vec3 grain=texture2D(finishMap,finishWorld.xz*.34+finishWorld.y*vec2(.23,.41)).rgb;
    float up=smoothstep(.2,.83,normalize(finishNormal).y);
    float moss=up*smoothstep(.54,.80,grain.g)*.16;
    float damp=(1.0-smoothstep(.05,.62,finishWorld.y))*(.10+.16*grain.g);
    diffuseColor.rgb*=.92+.10*grain.b;
    diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.69,.78,.54),moss+damp);`),
          p === 4 &&
            (P = `
    vec3 grain=texture2D(finishMap,vec2(finishWorld.x+finishWorld.z,finishWorld.y*.15)*1.4).rgb;
    diffuseColor.rgb*=.86+.23*grain.b;`),
          p === 5 &&
            (P = `
    vec3 grain=texture2D(finishMap,vec2((finishWorld.x+finishWorld.z)*.75,finishWorld.y*1.9)).rgb;
    float barkMarks=smoothstep(.66,.79,grain.g)*.48;
    diffuseColor.rgb*=1.0-barkMarks;`),
          (c.fragmentShader = c.fragmentShader.replace(
            "#include <color_fragment>",
            `#include <color_fragment>
` + P,
          )));
      }),
        (b.customProgramCacheKey = () => x + "|moulin-finish18-" + p),
        (b.needsUpdate = !0));
    }
    ((re.slate.normalMap = A.slateNormal), re.slate.normalScale.set(0.24, 0.24), (re.slate.roughness = 0.91));
    const O = new Uint8Array(4096 * 4);
    for (let b = 0; b < 64; b++)
      for (let p = 0; p < 64; p++) {
        const S = Math.hypot((p - 31.5) / 31.5, (b - 31.5) / 31.5),
          x = (b * 64 + p) * 4;
        ((O[x] = O[x + 1] = O[x + 2] = 25), (O[x + 3] = Math.round(Math.pow(Math.max(0, 1 - S), 1.7) * 104)));
      }
    const T = new t.MeshBasicMaterial({
        map: A.fromData(O, 64, !0, !1),
        transparent: !0,
        opacity: 0.72,
        depthWrite: !1,
        polygonOffset: !0,
        polygonOffsetFactor: -2,
      }),
      le = new t.PlaneGeometry(1, 1);
    le.rotateX(-Math.PI / 2);
    const X = [];
    n.updateMatrixWorld(!0);
    for (const [b, p] of [
      [
        "Salon_de_jardin_corail",
        [
          [0, 0.97, 2.6, 1.3],
          [-1.62, -0.12, 1.3, 1.2],
          [0.8, -1.11, 1.3, 1.2],
          [0, 0, 1.75, 1],
        ],
      ],
      [
        "Mobilier_de_la_terrasse",
        [
          [0, 0, 2.45, 1.35],
          [-0.68, -0.95, 0.55, 0.6],
          [0.68, -0.95, 0.55, 0.6],
          [-0.68, 0.95, 0.55, 0.6],
          [0.68, 0.95, 0.55, 0.6],
        ],
      ],
    ]) {
      const S = n.getObjectByName(b);
      if (S)
        for (const [x, c, P, C] of p) {
          const Ne = new t.Vector3(x, 0.022, c).applyMatrix4(S.matrixWorld);
          X.push({ p: Ne, w: P, d: C, yaw: S.rotation.y });
        }
    }
    const a = new t.InstancedMesh(le, T, X.length),
      _e = new t.Matrix4(),
      pe = new t.Quaternion();
    return (
      X.forEach((b, p) => {
        (pe.setFromAxisAngle(new t.Vector3(0, 1, 0), b.yaw),
          a.setMatrixAt(p, _e.compose(b.p, pe, new t.Vector3(b.w, 1, b.d))));
      }),
      (a.name = "Contacts_doux_du_mobilier"),
      (a.frustumCulled = !1),
      (a.renderOrder = 1),
      (a.userData.exportSkip = !0),
      n.add(a),
      { materials: he.size, contactCount: X.length }
    );
  }),
  (globalThis.MoulinStyleTextures27 = function (t, n) {
    "use strict";
    var pe, q, v, k;
    const re = (h, b, p) => Math.max(b, Math.min(p, h)),
      R = (h, b, p) => ((p = re((p - h) / (b - h), 0, 1)), p * p * (3 - 2 * p)),
      he = (h, b, p = 0) => {
        let S = Math.imul(h + 137 + p, 374761393) ^ Math.imul(b + 719, 668265263);
        return ((S = Math.imul(S ^ (S >>> 13), 1274126177)), ((S ^ (S >>> 16)) >>> 0) / 4294967295);
      },
      te = (h) => h - Math.floor(h);
    function O(h, b, p = 0.5) {
      const S = new Uint8Array(262144),
        x = new Float32Array(256 * 256),
        c = new Uint8Array(256 * 256 * 4);
      for (let Ne = 0; Ne < 256; Ne++)
        for (let z = 0; z < 256; z++) {
          const ce = b((z + 0.5) / 256, (Ne + 0.5) / 256, z, Ne),
            V = (Ne * 256 + z) * 4;
          for (let Me = 0; Me < 3; Me++) S[V + Me] = re(Math.round(ce[Me]), 0, 255);
          ((S[V + 3] = 255), (x[Ne * 256 + z] = ce[3]));
        }
      for (let Ne = 0; Ne < 256; Ne++)
        for (let z = 0; z < 256; z++) {
          const ce = (x[Ne * 256 + ((z + 256 - 1) % 256)] - x[Ne * 256 + ((z + 1) % 256)]) * p,
            V = (x[((Ne + 256 - 1) % 256) * 256 + z] - x[((Ne + 1) % 256) * 256 + z]) * p,
            Me = Math.hypot(ce, V, 1),
            je = (Ne * 256 + z) * 4;
          ((c[je] = ((ce / Me) * 0.5 + 0.5) * 255),
            (c[je + 1] = ((V / Me) * 0.5 + 0.5) * 255),
            (c[je + 2] = ((1 / Me) * 0.5 + 0.5) * 255),
            (c[je + 3] = 255));
        }
      const P = n.fromData(S, 256, !0, !0),
        C = n.fromData(c, 256, !1, !0);
      return ((P.name = h), (C.name = h + "_relief"), [P, C]);
    }
    function T(h, b, p, S, x) {
      const c = he(p, S),
        P = he(p >> 4, S >> 4, 3),
        C = c < 0.035 ? -22 : c > 0.976 ? 10 : 0,
        Ne = 3.2 * Math.sin(h * 18 + b * 9) + 2.4 * Math.sin(b * 27 - h * 11),
        z = (c - 0.5) * 9 + (P - 0.5) * 5 + Ne + C,
        ce = Math.min(h, 1 - h, b, 1 - b),
        V = x ? R(0.004, 0.025, ce) : 1,
        Me = x ? (1 - R(0.024, 0.045, ce)) * (h + b < 1 ? 2.2 : -1.5) : 0,
        je = 1 - (1 - V) * 0.115;
      return [(232 + z + Me) * je, (230 + z + Me) * je, (222 + z * 0.86 + Me) * je, (c - 0.5) * 0.065 + V * 0.2];
    }
    const le = O("Granit_grain_fin_v27", (h, b, p, S) => T(h, b, p, S, !1), 0.9),
      X = O("Pierres_taillees_aretes_adoucies_v27", (h, b, p, S) => T(h, b, p, S, !0), 4),
      a = O(
        "Ardoises_chevauchees_bleu_gris_v27",
        (h, b, p, S) => {
          const x = Math.floor(b * 8),
            c = Math.floor(h * 4 + (x % 2) * 0.5),
            P = te(h * 4 + (x % 2) * 0.5),
            C = te(b * 8),
            Ne = he(c, x, 19),
            z = Math.min(P, 1 - P),
            ce = R(0.008, 0.034, z) * R(0.015, 0.075, C),
            V = R(0.85, 0.96, C) * (1 - R(0.975, 1, C)),
            Me = Math.sin(P * 14 + Ne * 8 + C * 7) * 1.8 + (he(p, S) - 0.5) * 3.5,
            je =
              (1 - R(0.005, 0.012, Math.abs(P - (0.25 + Ne * 0.5 + 0.024 * Math.sin(C * 14 + Ne * 4))))) *
              (1 - R(0.28, 0.76, C)) *
              (Ne > 0.73 ? 1 : 0),
            lt = (Ne - 0.5) * 15 + Me - je * 13 + V * 7,
            Ke = 0.6 + 0.4 * ce;
          return [(87 + lt) * Ke, (116 + lt) * Ke, (142 + lt) * Ke, ce * 0.34 + V * 0.075 + (he(p, S) - 0.5) * 0.016];
        },
        3.1,
      ),
      _e = O(
        "Boiseries_chene_grain_fin_v28",
        (h, b, p, S) => {
          const x = h + 0.011 * Math.sin(b * 12) + 0.006 * Math.sin(b * 31),
            c = Math.sin(x * 310 + Math.sin(x * 49) * 2.2),
            P = Math.hypot((h - 0.35) * 3.8, (b - 0.57) * 1.4),
            C = Math.sin(P * 73) * Math.exp(-P * 9),
            Ne = he(p, S) < 0.045 ? -5 : 0,
            z = c * 2.8 + C * 8 + (he(p, S) - 0.5) * 3 + Ne;
          return [227 + z, 220 + z, 207 + z, 0.3 + c * 0.018 + C * 0.035];
        },
        1.4,
      );
    for (const h of ["wood20", "woodNormal20"]) (q = (pe = n[h]) == null ? void 0 : pe.dispose) == null || q.call(pe);
    [n.wood20, n.woodNormal20] = _e;
    for (const h of ["stone20", "stoneNormal20", "slate20", "slateNormal20"])
      (k = (v = n[h]) == null ? void 0 : v.dispose) == null || k.call(v);
    return (
      ([n.stone20, n.stoneNormal20] = le),
      ([n.masonry27, n.masonryNormal27] = X),
      ([n.slate20, n.slateNormal20] = a),
      (n.style27 = { maps: 8, size: 256, extraDraws: 0, extraTriangles: 0, version: 28 }),
      n.style27
    );
  }),
  (globalThis.MoulinSurfaces = async function (t) {
    const n = globalThis.MoulinHost30.assets,
      A = {},
      re = (O) => O - Math.floor(O),
      R = (O, T) => re(Math.sin(O * 127.1 + T * 311.7) * 43758.5453);
    ((A.noise = (O, T) => {
      const le = Math.floor(O),
        X = Math.floor(T),
        a = re(O),
        _e = re(T),
        pe = a * a * (3 - 2 * a),
        q = _e * _e * (3 - 2 * _e);
      return (
        (R(le, X) * (1 - pe) + R(le + 1, X) * pe) * (1 - q) + (R(le, X + 1) * (1 - pe) + R(le + 1, X + 1) * pe) * q
      );
    }),
      (A.fromData = (O, T, le = !0, X = !0) => {
        const a = new t.DataTexture(O, T, T, t.RGBAFormat);
        return (
          (a.wrapS = a.wrapT = X ? t.RepeatWrapping : t.ClampToEdgeWrapping),
          (a.magFilter = t.LinearFilter),
          (a.minFilter = t.LinearMipmapLinearFilter),
          (a.generateMipmaps = !0),
          (a.anisotropy = 4),
          (a.encoding = le ? t.sRGBEncoding : t.LinearEncoding),
          (a.needsUpdate = !0),
          a
        );
      }),
      await Promise.all(
        Object.entries(n.textures).map(async ([O, T]) => {
          const le = new Image();
          await new Promise((a, _e) => {
            ((le.onload = a), (le.onerror = () => _e(new Error("Texture indisponible : " + O))), (le.src = T.uri));
          });
          const X = new t.Texture(le);
          ((X.encoding = T.color ? t.sRGBEncoding : t.LinearEncoding),
            (X.wrapS = X.wrapT = T.repeat ? t.RepeatWrapping : t.ClampToEdgeWrapping),
            (X.flipY = T.flipY ?? !0),
            (X.anisotropy = 4),
            (X.needsUpdate = !0),
            (A[O] = X));
        }),
      ));
    const he = (O, T) => new T(globalThis.MoulinHost30.geometry, O.offset, O.bytes / T.BYTES_PER_ELEMENT),
      te = {};
    for (const [O, T] of Object.entries(n.models))
      te[O] = T.map((le) => {
        const X = new t.BufferGeometry();
        for (const [a, _e] of [
          ["position", 3],
          ["normal", 3],
          ["uv", 2],
          ["color", 3],
        ])
          X.setAttribute(a, new t.BufferAttribute(he(le[a], Float32Array), _e));
        return (
          X.setIndex(new t.BufferAttribute(he(le.index, Uint32Array), 1)),
          X.computeBoundingBox(),
          X.computeBoundingSphere(),
          X
        );
      });
    return ((A.assetGeometry = (O, T = 0) => te[O][T]), (A.sources = n.sources), A);
  }),
  (globalThis.MoulinLandscapeStyle = function (t, n) {
    const {
        model: A,
        surfaces: re,
        standard: R,
        rgb: he,
        terrainHeight: te,
        wetAt: O,
        inside: T,
        edgeDistance: le,
        waterRegions: X,
        channels: a,
        channelSample: _e,
        paths: pe,
        hillWalk: q,
        yard: v,
        patio: k,
        pointGarden: h,
        forest: b,
        scope: p,
        bridges: S,
      } = n,
      x = new t.Group();
    ((x.name = "Berges_et_sous_bois_low_poly"), A.add(x));
    const c = (W, D, De = 0) => {
        const ke = Math.sin(W * 127.1 + D * 311.7 + De * 73.4) * 43758.5453;
        return ke - Math.floor(ke);
      },
      P = (W, D) => p === "all" || Math.hypot(W, D) < 86,
      C = (W, D, De = 0.9) =>
        !n.propertyTrails.some((ke) => {
          const rt = n.trailSample([W, D], ke, De + 1);
          return rt && rt.d < De + 1;
        }) &&
        !T([W, D], v) &&
        !T([W, D], k) &&
        !T([W, D], h) &&
        le([W, D], q, !1) > De &&
        pe.every((ke) => le([W, D], ke, !1) > De + 0.5) &&
        !(W > -7 && W < 9 && D > -14 && D < 8) &&
        !S.some((ke) => Math.hypot(W - ke.centre[0], D - ke.centre[1]) < Math.max(ke.length, ke.width) / 2 + 1),
      Ne = [[], [], []],
      z = [],
      ce = [],
      V = [],
      Me = [],
      je = [];
    function lt(W, D, De, ke, rt, $e) {
      if (!P(W, D) || !C(W, D, 1.2) || (W > -25 && W < 18 && D > 7 && D < 19)) return;
      const B = c(W, D, 2),
        F = 0.4 + 0.8 * B,
        g = W + De * F,
        G = D + ke * F;
      if (O([g, G], 0.05) || !C(g, G, 1.15)) return;
      const Qe = te(g, G);
      if (!(Qe > rt + 1.65 || Qe < rt - 0.06)) {
        if (
          (je.push({ x: W, z: D, level: rt }),
          B < 0.7 && Me.push({ x: g, z: G, r: 0.42 + B * 0.64, phase: $e }),
          B < 0.45)
        ) {
          const Fe = $e % 3,
            Le = 0.85 + c(W, D, 4) * 1.4;
          Ne[Fe].push({
            x: g,
            z: G,
            s: [Le, Le * (Fe === 2 ? 0.5 : 1.6), Le * 0.84],
            rot: B * 11,
            offset: -0.105 * Le,
          });
          for (let pt = 0; pt < 2; pt++) {
            const Ge = g + De * (0.9 + pt * 0.35) + ke * (pt ? 1 : -1) * 0.58,
              m = G + ke * (0.9 + pt * 0.35) - De * (pt ? 1 : -1) * 0.58;
            !O([Ge, m], 0.05) && C(Ge, m) && z.push({ x: Ge, z: m, s: [3, 3.3, 3], rot: pt * 2.4 + B });
          }
        }
        if (B > 0.46 && B < 0.9)
          for (let Fe = 0; Fe < 2 + ($e % 3); Fe++) {
            const Le = g + ke * (Fe - 1) * 0.46 + De * 0.2,
              pt = G - De * (Fe - 1) * 0.46 + ke * 0.2;
            if (O([Le, pt], 0.02) || !C(Le, pt, 1)) continue;
            const Ge = 0.75 + c(Le, pt) * 0.6;
            V.push({ x: Le, z: pt, s: [Ge * 3.7, Ge * (6.6 + c(Le, pt, 5) * 2.2), Ge * 3.7], rot: B * 9 + Fe * 2.4 });
          }
      }
    }
    for (const W of X) {
      let D = 0,
        De = 0;
      for (let ke = 0; ke < W.poly.length; ke++) {
        const rt = W.poly[ke],
          $e = W.poly[(ke + 1) % W.poly.length],
          B = $e[0] - rt[0],
          F = $e[1] - rt[1],
          g = Math.hypot(B, F);
        if (((D += g), D < 2.1 || g < 0.001)) continue;
        D = 0;
        let G = -F / g,
          Qe = B / g;
        (T([rt[0] + G * 0.6, rt[1] + Qe * 0.6], W.poly) && ((G = -G), (Qe = -Qe)),
          lt(rt[0], rt[1], G, Qe, W.level, De++));
      }
    }
    for (const W of a) {
      if (W.name === "Bief_du_moulin") continue;
      let D = 0;
      for (let De = 0; De < W.line.length - 1; De++) {
        const ke = W.line[De],
          rt = W.line[De + 1],
          $e = rt[0] - ke[0],
          B = rt[1] - ke[1],
          F = Math.hypot($e, B);
        for (let g = 1.3; g < F; g += 3.2) {
          const G = ke[0] + ($e * g) / F,
            Qe = ke[1] + (B * g) / F,
            Fe = _e([G, Qe], W);
          for (const Le of [-1, 1])
            lt(
              G - (B / F) * (Fe.width / 2 + 0.12) * Le,
              Qe + ($e / F) * (Fe.width / 2 + 0.12) * Le,
              (-B / F) * Le,
              ($e / F) * Le,
              Fe.height,
              D++,
            );
        }
      }
    }
    for (const W of b.records) {
      if (!P(W.x, W.z) || c(W.x, W.z, 36) < 0.5) continue;
      const D = Math.hypot(W.x, W.z) < 62,
        De = c(W.x, W.z, 43),
        ke = D ? 3 : 2;
      for (let rt = 0; rt < ke; rt++) {
        const $e = W.rotation + (rt - 1) * 0.73 + (c(W.x, W.z, rt) - 0.5) * 0.4,
          B = Math.max(0.72, W.diameter * 1.15) + c(W.x, W.z, rt + 5) * 0.92,
          F = W.x + Math.cos($e) * B,
          g = W.z + Math.sin($e) * B;
        if (!(O([F, g], 0.15) || !C(F, g, 1.15)))
          if (De > 0.3) {
            const G = (D ? 0.84 : 0.7) + c(F, g, 8) * 0.53;
            ce.push({ x: F, z: g, s: [G, G * (0.8 + c(g, F) * 0.35), G], rot: $e });
          } else {
            const G = 1.55 + c(F, g) * 0.85;
            z.push({ x: F, z: g, s: [G, G * 0.79, G], rot: $e });
          }
      }
    }
    const Ke = [],
      ve = new t.Object3D();
    function qe(W, D, De, ke, rt) {
      if (!ke.length) return;
      D.computeBoundingBox();
      const $e = new Map();
      for (const B of ke) {
        const F = Math.floor(B.x / 64) + ":" + Math.floor(B.z / 64);
        ($e.has(F) || $e.set(F, []), $e.get(F).push(B));
      }
      for (const [B, F] of $e) {
        const g = new t.BufferGeometry();
        g.index = D.index;
        for (const Qe of Object.keys(D.attributes)) g.setAttribute(Qe, D.attributes[Qe]);
        const G = new t.InstancedMesh(g, De, F.length);
        ((G.name = W + "_" + B),
          (G.castShadow = W.startsWith("Rochers")),
          (G.receiveShadow = !0),
          (G.frustumCulled = !0),
          F.forEach((Qe, Fe) => G.setColorAt(Fe, he(rt[Math.floor(c(Qe.x, Qe.z, 8) * rt.length)]))),
          x.add(G),
          Ke.push({ mesh: G, records: F, bounds: D.boundingBox.clone() }));
      }
    }
    const Xe = R("#ffffff", { roughness: 1, metalness: 0, vertexColors: !0, flatShading: !0, envMapIntensity: 0 });
    Ne.forEach((W, D) =>
      qe("Rochers_de_berge_" + D, re.assetGeometry("Rock_Medium_" + (D + 1)), Xe, W, [
        "#929b96",
        "#a5aea2",
        "#b9c0b2",
        "#919d96",
      ]),
    );
    const _t = R("#ffffff", {
      roughness: 1,
      metalness: 0,
      vertexColors: !0,
      flatShading: !0,
      side: t.DoubleSide,
      envMapIntensity: 0,
    });
    function Mt() {
      const W = [],
        D = [],
        De = (rt, $e, B, F) => {
          W.push(...rt, ...$e, ...B);
          for (let g = 0; g < 3; g++) D.push(F, F, F);
        };
      for (let rt = 0; rt < 7; rt++) {
        const $e = rt * 2.39996,
          B = 0.55 + (rt % 3) * 0.075,
          F = Math.sin($e),
          g = Math.cos($e),
          G = g,
          Qe = -F,
          Fe = (Le) => [F * B * Le, 0.035 + Math.sin(Le * Math.PI * 0.8) * (0.4 + (rt % 3) * 0.035), g * B * Le];
        for (let Le = 1; Le <= 6; Le++) {
          const pt = Le / 7,
            Ge = Fe(pt - 0.12),
            m = Fe(pt),
            at = Fe(Math.min(1, pt + 0.11)),
            ft = Math.sin(pt * Math.PI) * 0.12;
          De([Ge[0] - 0.005 * G, Ge[1], Ge[2] - 0.005 * Qe], [Ge[0] + 0.005 * G, Ge[1], Ge[2] + 0.005 * Qe], m, 0.7);
          for (const ue of [-1, 1]) {
            const se = [m[0] + G * ft * ue - F * 0.045, m[1] - 0.012, m[2] + Qe * ft * ue - g * 0.045],
              Ve = [m[0] + G * ft * 0.38 * ue + F * 0.014, m[1] + 0.021, m[2] + Qe * ft * 0.38 * ue + g * 0.014];
            (De(Ge, se, Ve, 0.83 + (Le % 2) * 0.055), De(Ve, se, at, 0.96));
          }
        }
      }
      const ke = new t.BufferGeometry();
      return (
        ke.setAttribute("position", new t.Float32BufferAttribute(W, 3)),
        ke.setAttribute("color", new t.Float32BufferAttribute(D, 3)),
        ke.computeVertexNormals(),
        ke
      );
    }
    const st = { time: { value: 0 }, force: { value: 0 }, direction: { value: new t.Vector2(0.96, 0.28) } };
    ((_t.onBeforeCompile = (W) => {
      ((W.uniforms.uBankTime28 = st.time),
        (W.uniforms.uBankWind28 = st.force),
        (W.uniforms.uBankDirection28 = st.direction),
        (W.vertexShader =
          `uniform float uBankTime28,uBankWind28;uniform vec2 uBankDirection28;
` + W.vertexShader),
        (W.vertexShader = W.vertexShader.replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
  vec3 bankOrigin28=vec3(0.),bankX28=vec3(1.,0.,0.),bankZ28=vec3(0.,0.,1.);
  #ifdef USE_INSTANCING
   bankOrigin28=instanceMatrix[3].xyz;bankX28=instanceMatrix[0].xyz;bankZ28=instanceMatrix[2].xyz;
  #endif
  float bankMask28=pow(clamp(position.y*5.0,0.,1.),1.6);
  float bankPhase28=dot(bankOrigin28.xz,vec2(.137,.091));
  float bankSway28=bankMask28*uBankWind28*(.043+.029*sin(uBankTime28*1.9+bankPhase28)+.012*sin(uBankTime28*4.1+position.x*8.));
  transformed.x+=bankSway28*dot(uBankDirection28,bankX28.xz)/max(.01,dot(bankX28,bankX28));
  transformed.z+=bankSway28*dot(uBankDirection28,bankZ28.xz)/max(.01,dot(bankZ28,bankZ28));
 `,
        )));
    }),
      (_t.customProgramCacheKey = () => "bank-foliage-wind28"),
      qe("Fougeres_en_poches_de_sous_bois", Mt(), _t, ce, ["#547849", "#67884b", "#76954f", "#5d8046"]),
      qe("Touffes_au_pied_des_arbres", re.assetGeometry("Grass_Clump"), _t, z, [
        "#668344",
        "#738e4a",
        "#829a52",
        "#72904d",
      ]),
      qe("Roseaux_en_groupes_irreguliers", re.assetGeometry("Reed_Clump"), _t, V, [
        "#507647",
        "#618347",
        "#75924e",
        "#809951",
      ]));
    const $ = [],
      U = [],
      He = [];
    Me.forEach((W) => {
      const D = $.length / 3,
        De = 9;
      for (let ke = 0; ke <= De; ke++) {
        const rt = ke ? ((ke - 1) / De) * Math.PI * 2 : 0,
          $e = ke ? W.r * (0.78 + c(W.x, W.z, ke) * 0.4) : 0,
          B = W.x + Math.cos(rt) * $e,
          F = W.z + Math.sin(rt) * $e;
        $.push(B, te(B, F) + 0.018, F);
        const g = he(ke ? "#7d7c5d" : "#686e54");
        U.push(g.r, g.g, g.b);
      }
      for (let ke = 0; ke < De; ke++) He.push(D, D + 1 + ((ke + 1) % De), D + 1 + ke);
    });
    const Ce = new t.BufferGeometry();
    (Ce.setAttribute("position", new t.Float32BufferAttribute($, 3)),
      Ce.setAttribute("color", new t.Float32BufferAttribute(U, 3)),
      Ce.setIndex(He),
      Ce.computeVertexNormals());
    const xe = new t.Mesh(
      Ce,
      R("#ffffff", {
        roughness: 1,
        metalness: 0,
        vertexColors: !0,
        side: t.DoubleSide,
        polygonOffset: !0,
        polygonOffsetFactor: -1,
        envMapIntensity: 0,
      }),
    );
    ((xe.name = "Terre_visible_au_bord_des_berges"),
      (xe.receiveShadow = !0),
      (xe.userData.dynamicGround = !0),
      x.add(xe));
    function H() {
      for (const { mesh: D, records: De, bounds: ke } of Ke) {
        const rt = new t.Box3();
        (De.forEach(($e, B) => {
          (ve.position.set($e.x, te($e.x, $e.z) + ($e.offset || 0.015), $e.z),
            ve.rotation.set(0, $e.rot, 0),
            ve.scale.set(...$e.s),
            ve.updateMatrix(),
            D.setMatrixAt(B, ve.matrix),
            rt.union(ke.clone().applyMatrix4(ve.matrix)));
        }),
          (D.instanceMatrix.needsUpdate = !0),
          (D.geometry.boundingBox = rt),
          (D.geometry.boundingSphere = rt.getBoundingSphere(new t.Sphere())));
      }
      const W = Ce.attributes.position;
      for (let D = 0; D < W.count; D++) W.setY(D, te(W.getX(D), W.getZ(D)) + 0.018);
      ((W.needsUpdate = !0), Ce.computeVertexNormals(), Ce.computeBoundingSphere());
    }
    return (
      H(),
      {
        group: x,
        resettle: H,
        update(W, D, De) {
          ((st.time.value = W),
            (st.force.value = Math.max(0, Math.min(1.8, D || 0))),
            De && st.direction.value.copy(De));
        },
        sway28: st,
        stats: {
          ferns: ce.length,
          rocks: Ne.reduce((W, D) => W + D.length, 0),
          grass: z.length,
          reeds: V.length,
          earth: Me.length,
          bankPoints: je.length,
          scope: p,
        },
      }
    );
  }),
  (globalThis.MoulinArtDetails = function (t, n) {
    const {
        model: A,
        house: re,
        annex: R,
        materials: he,
        standard: te,
        surfaces: O,
        box: T,
        beam: le,
        terrainHeight: X,
        wetAt: a,
        Batch: _e,
      } = n,
      pe = te("#565d59", { roughness: 0.78, metalness: 0.22 }),
      q = te("#b4ae98", { roughness: 1, map: O.stone }),
      v = te("#655343", { roughness: 0.92, map: O.wood });
    for (const P of [-4.31, 4.31])
      for (const C of [-6.84, 6.84]) {
        T(0.11, 6.05, 0.11, [P, 3.05, C], pe, "Descente_de_gouttiere", re);
        for (const Ne of [0.45, 3, 5.7]) T(0.18, 0.08, 0.17, [P, Ne, C], pe, "Collier_de_gouttiere", re);
      }
    for (const [P, C] of [
      [-4.24, -7.12],
      [4.24, -7.12],
      [-4.24, 7.12],
      [4.24, 7.12],
    ])
      for (let Ne = 0.3; Ne < 6.25; Ne += 0.46) {
        const z = Math.round(Ne / 0.46) % 2;
        T(z ? 0.58 : 0.32, 0.29, z ? 0.32 : 0.58, [P, Ne, C], q, "Pierre_d_angle", re);
      }
    for (let P = 0; P < 3; P++)
      T(1.78, 0.15, 1.18 - P * 0.27, [-2.05, 0.075 + P * 0.15, 7.4 - P * 0.07], q, "Marches_de_la_porte", re);
    const k = te("#343f3c", { roughness: 0.65, metalness: 0.38 }),
      h = te("#e9be73", { roughness: 0.45, emissive: 8275739, emissiveIntensity: 0.24 });
    for (const P of [-3.18, 3.15]) {
      (T(0.08, 0.47, 0.1, [P, 2.45, 7.25], k, "Console_de_lanterne", re),
        T(0.26, 0.35, 0.24, [P, 2.38, 7.43], h, "Verre_ambre_lanterne", re));
      for (const C of [2.16, 2.6]) T(0.34, 0.065, 0.32, [P, C, 7.43], k, "Chapeau_lanterne", re);
      for (const C of [-1, 1]) T(0.026, 0.41, 0.026, [P + C * 0.14, 2.38, 7.56], k, "Armature_lanterne", re);
    }
    re.traverse((P) => {
      (P.name === "Jouees_lucarne" || P.name === "Pierre_lucarne_est") && (P.material = he.masonry);
    });
    const b = te("#b5bdba", { roughness: 1, metalness: 0, vertexColors: !0, flatShading: !0 }),
      p = new _e(b, "Pierres_naturelles_des_berges", A);
    ([
      [15.9, 13.8, 0.43],
      [20, 16.8, 0.48],
      [26.5, 23, 0.36],
      [-25, 24, 0.36],
      [-34, 26, 0.4],
      [15, -9, 0.44],
      [12.8, -12, 0.26],
      [-7, 22, 0.3],
      [6, 22, 0.22],
    ].forEach(([P, C, Ne], z) => {
      a([P, C], 0.08) ||
        p.add(
          O.assetGeometry("Rock_Medium_" + ((z % 3) + 1)),
          [P, X(P, C) - 0.08, C],
          [Ne, Ne * 0.64, Ne],
          ["#a7aa92", "#969d8d", "#adb09d"][z % 3],
          [0, z * 2.4, 0],
        );
    }),
      p.finish());
    const x = new _e(
        te("#a0a08b", { vertexColors: !0, map: O.stone, roughness: 1, color: 16777215 }),
        "Dalles_irregulieres_pres_du_moulin",
        re,
      ),
      c = new t.CylinderGeometry(1, 1, 0.12, 6);
    for (let P = 0; P < 6; P++) {
      const C = -2.05 + (P % 2) * 0.08,
        Ne = 8.1 + P * 0.47;
      x.add(c, [C, 0.045, Ne], [0.42, 1, 0.24], P % 2 ? "#aca891" : "#b9b29c", [0, P * 0.83, 0]);
    }
    x.finish();
  }),
  (globalThis.MoulinTreeFamily = function (t) {
    if (t.species && t.species !== "oak") return t.species;
    const n = Math.abs(Math.sin(t.x * 12.43 + t.z * 5.87) * 43758.5453) % 1;
    return /Grand chêne/.test(t.label) || (t.diameter > 1.1 && n > 0.78)
      ? "old"
      : t.x < -12 && t.z < -22
        ? n < 0.43
          ? "birch"
          : n < 0.72
            ? "pine"
            : "oak"
        : n < 0.15
          ? "pine"
          : n < 0.22
            ? "birch"
            : n > 0.955
              ? "old"
              : "oak";
  }),
  (globalThis.MoulinForest = function (t, n) {
    const { root: A, ground: re, surfaces: R, standard: he, rgb: te } = n,
      O = [],
      T = new Map(),
      le = [],
      X = {
        oak: { label: "Feuillu \xE0 couronne naturelle" },
        pine: { label: "Sapin des sous-bois" },
        birch: { label: "Bouleau l\xE9ger" },
        old: { label: "Vieux ch\xEAne \xE9tal\xE9" },
      },
      a = he("#82705c", { roughness: 1, metalness: 0, vertexColors: !0, flatShading: !0, envMapIntensity: 0 }),
      _e = he("#e2e1d6", { roughness: 1, metalness: 0, vertexColors: !0, flatShading: !0, envMapIntensity: 0 }),
      pe = new t.MeshLambertMaterial({ color: 16777215, vertexColors: !0 });
    pe.name = "Couronnes_naturelles_facettees_v28";
    let q = 0,
      v = 0,
      k = -1,
      h = null;
    const b = { uniform: 0, near: 0, middle: 0, far: 0, triangles: 0, draws: 0 },
      p = new t.Vector3(0, 1, 0),
      S = new t.Matrix4(),
      x = new t.Quaternion(),
      c = new t.Vector3(),
      P = new t.Vector3(),
      C = new Uint8Array(4096 * 4);
    for (let Ce = 0; Ce < 64; Ce++)
      for (let xe = 0; xe < 64; xe++) {
        const H = (Ce * 64 + xe) * 4,
          W = Math.hypot((xe - 31.5) / 31.5, (Ce - 31.5) / 31.5);
        ((C[H] = C[H + 1] = C[H + 2] = 35), (C[H + 3] = Math.round(Math.pow(Math.max(0, 1 - W), 2) * 105)));
      }
    const Ne = R.fromData(C, 64, !0, !1),
      z = new t.MeshBasicMaterial({
        map: Ne,
        transparent: !0,
        depthWrite: !1,
        polygonOffset: !0,
        polygonOffsetFactor: -2,
        opacity: 0.65,
      }),
      ce = new t.PlaneGeometry(1, 1);
    ce.rotateX(-Math.PI / 2);
    const V = {
        oak: ["#6f9a41", "#5b8a3d", "#86a84b", "#679646"],
        pine: ["#41705a", "#37664e", "#517d62", "#406c53"],
        birch: ["#93b35b", "#7fa24d", "#a0b963", "#8aab56"],
        old: ["#6a8f43", "#789e49", "#5d8641", "#80a04d"],
      },
      Me = (Ce) => {
        const xe = te(V[Ce.species][Math.abs(Ce.variant || 0) % 4]),
          H = Math.sin(Ce.x * 17.17 + Ce.z * 8.13) * 43758.5453;
        return xe.multiplyScalar(0.94 + (H - Math.floor(H)) * 0.1);
      };
    function je(Ce) {
      const xe = Ce.species === "oak" ? Ce.variant : Ce.variant % 2,
        H = ["arbre-1239", "arbre-1256", "arbre-1257", "arbre-274"].includes(Ce.id),
        W = Ce.species + ":" + xe + ":" + H;
      if (T.has(W)) return T.get(W);
      const D = MoulinTreeGeometry20(t, Ce.species, xe, H),
        De = D.map((ke, rt) => new t.Mesh(ke, rt === 2 ? pe : Ce.species === "birch" ? _e : a));
      return (T.set(W, De), De);
    }
    function lt(Ce) {
      const xe = X[Ce.species] ? Ce.species : "oak",
        H = {
          id: Ce.id || "arbre-" + ++q,
          species: xe,
          x: +Ce.x,
          z: +Ce.z,
          height: Ce.height || 15,
          diameter: Ce.diameter || 0.68,
          spread: Ce.spread || 1,
          rotation: Ce.rotation ?? (q * 2.39996) % 6.283,
          variant: Ce.variant ?? q % 4,
          label: Ce.label || X[xe].label,
        };
      return ((q = Math.max(q, Number(H.id.split("-").pop()) || 0)), O.push(H), v++, H);
    }
    function Ke(Ce, xe) {
      (P.set(Ce.x, re(Ce.x, Ce.z), Ce.z), x.setFromAxisAngle(p, Ce.rotation));
      const H = xe === 0 ? Ce.diameter / 0.054 : Ce.height * Ce.spread;
      return (c.set(H, Ce.height, H), S.compose(P, x, c));
    }
    function ve() {
      var xe, H;
      for (const W of le)
        for (const D of W.meshes) (A.remove(D), D.geometry.dispose(), (xe = D.dispose) == null || xe.call(D));
      ((le.length = 0),
        h && (A.remove(h), (H = h.dispose) == null || H.call(h)),
        (h = new t.InstancedMesh(ce, z, Math.max(1, O.length))),
        (h.name = "Ombres_de_contact_des_arbres"),
        (h.count = O.length),
        (h.frustumCulled = !1),
        (h.renderOrder = 1),
        A.add(h));
      const Ce = new Map();
      for (const W of O) {
        const D =
          W.species +
          ":" +
          (W.species === "oak" ? W.variant : W.variant % 2) +
          ":" +
          (["arbre-1239", "arbre-1256", "arbre-1257", "arbre-274"].includes(W.id) ? "hero:" : "basic:") +
          Math.floor(W.x / 96) +
          ":" +
          Math.floor(W.z / 96);
        (Ce.has(D) || Ce.set(D, []), Ce.get(D).push(W));
      }
      for (const [W, D] of Ce) {
        const De = je(D[0]).map((ke, rt) => {
          const $e = new t.BufferGeometry();
          $e.index = ke.geometry.index;
          for (const F of Object.keys(ke.geometry.attributes)) $e.setAttribute(F, ke.geometry.attributes[F]);
          const B = new t.InstancedMesh($e, ke.material, D.length);
          return (
            (B.name = "Arbres_" + W + "_" + rt),
            (B.castShadow = !0),
            (B.receiveShadow = !0),
            (B.frustumCulled = !0),
            B.instanceMatrix.setUsage(t.DynamicDrawUsage),
            (B.userData.treeIds = D.map((F) => F.id)),
            (B.userData.treePart = rt),
            rt === 2 && D.forEach((F, g) => B.setColorAt(g, Me(F))),
            A.add(B),
            B
          );
        });
        le.push({ list: D, meshes: De });
      }
      (v++, qe(null, null, !0), A.updateMatrixWorld(!0));
    }
    function qe(Ce, xe, H = !1) {
      if (!H && v === k) return !1;
      ((k = v), (b.uniform = b.near = O.length), (b.middle = b.far = b.triangles = b.draws = 0));
      for (const W of le) {
        const D = new t.Box3();
        for (const De of W.list) {
          const ke = re(De.x, De.z),
            rt = Math.max(De.height * De.spread * 0.58, De.diameter * 4);
          (D.expandByPoint(new t.Vector3(De.x - rt, ke - 0.2, De.z - rt)),
            D.expandByPoint(new t.Vector3(De.x + rt, ke + De.height * 1.09, De.z + rt)));
        }
        for (let De = 0; De < W.meshes.length; De++) {
          const ke = W.meshes[De];
          ((ke.geometry.boundingBox = D.clone()),
            (ke.geometry.boundingSphere = D.getBoundingSphere(new t.Sphere())),
            W.list.forEach((rt, $e) => ke.setMatrixAt($e, Ke(rt, De))),
            (ke.instanceMatrix.needsUpdate = !0),
            b.draws++,
            (b.triangles += (ke.geometry.index.count / 3) * ke.count));
        }
      }
      if (h) {
        const W = new t.Vector3(0, 1, 0);
        (O.forEach((D, De) => {
          const ke = re(D.x, D.z),
            rt = (re(D.x + 0.2, D.z) - re(D.x - 0.2, D.z)) / 0.4,
            $e = (re(D.x, D.z + 0.2) - re(D.x, D.z - 0.2)) / 0.4,
            B = new t.Vector3(-rt, 1, -$e).normalize(),
            F = Math.max(1.4, Math.min(4, D.diameter * 3.5));
          (P.set(D.x, ke + 0.025, D.z),
            x.setFromUnitVectors(W, B),
            c.set(F, 1, F),
            h.setMatrixAt(De, S.compose(P, x, c)));
        }),
          (h.instanceMatrix.needsUpdate = !0));
      }
      return !0;
    }
    function Xe(Ce, xe) {
      const H = O.find((D) => D.id === Ce);
      if (!H) return;
      const W = H.species + ":" + H.variant;
      (Object.assign(H, xe),
        X[H.species] || (H.species = "oak"),
        v++,
        W !== H.species + ":" + H.variant ? ve() : qe(null, null, !0));
    }
    function _t(Ce) {
      const xe = O.findIndex((H) => H.id === Ce);
      xe >= 0 && (O.splice(xe, 1), ve());
    }
    function Mt() {
      (v++, qe(null, null, !0));
    }
    function st(Ce) {
      let xe = null;
      const H = new t.Mesh();
      for (const W of O) {
        const D = new t.Sphere(
          new t.Vector3(W.x, re(W.x, W.z) + W.height * 0.6, W.z),
          W.height * Math.max(0.6, W.spread * 0.6),
        );
        if (!Ce.ray.intersectsSphere(D)) continue;
        const De = je(W);
        for (let ke = 0; ke < De.length; ke++) {
          ((H.geometry = De[ke].geometry), (H.material = De[ke].material), H.matrixWorld.copy(Ke(W, ke)));
          const rt = [];
          H.raycast(Ce, rt);
          for (const $e of rt)
            (!xe || $e.distance < xe.distance) && (xe = { id: W.id, point: $e.point, distance: $e.distance });
        }
      }
      return xe;
    }
    function $(Ce) {
      ((O.length = 0), (q = 0), Ce.forEach(lt), ve());
    }
    function U() {
      const Ce = new t.Group();
      Ce.name = "Boisements";
      for (const xe of O) {
        const H = new t.Group();
        ((H.name = xe.id),
          je(xe).forEach((W, D) => {
            const De = W.material.clone();
            D === 2 && De.color.copy(Me(xe));
            const ke = new t.Mesh(W.geometry, De);
            (Ke(xe, D).decompose(ke.position, ke.quaternion, ke.scale), H.add(ke));
          }),
          Ce.add(H));
      }
      return Ce;
    }
    A.userData.forestRender = !0;
    const He = {
      setDaylight: () => {},
      records: O,
      species: X,
      stats: b,
      materials: [a, _e, pe],
      add: lt,
      rebuild: ve,
      update: Xe,
      remove: _t,
      resettle: Mt,
      pick: st,
      replace: $,
      updateLOD: qe,
      exportGroup: U,
      get: (Ce) => O.find((xe) => xe.id === Ce),
      get count() {
        return O.length;
      },
    };
    return ((A.moulinForest = He), He);
  }),
  (globalThis.MoulinStaticExport = function (t, n, A) {
    const re = n.clone(!0),
      R = new Map();
    re.traverse((le) => {
      ((le.isLight || le.userData.editorHelper) && (le.visible = !1),
        le.userData.isWater && ((le.material = A), (le.onBeforeRender = () => {})),
        le.userData.exportSkip && (le.visible = !1),
        le.userData.renderSource && (le.visible = !0));
    });
    const he = n.getObjectByName("Boisements"),
      te = re.getObjectByName("Boisements");
    if (he != null && he.moulinForest && te) {
      for (const X of [...te.children]) X.isInstancedMesh && te.remove(X);
      const le = he.moulinForest.exportGroup();
      for (const X of [...le.children]) te.add(X);
      te.visible = !0;
    }
    const O = n.getObjectByName("Objets_du_jardin_editeur"),
      T = re.getObjectByName("Objets_du_jardin_editeur");
    return (
      O != null && O.moulinProps && T && (T.parent.remove(T), re.add(O.moulinProps.exportGroup())),
      re.traverse((le) => {
        var X;
        if ((X = le.material) != null && X.isMeshLambertMaterial) {
          const a = le.material;
          (R.has(a) ||
            R.set(
              a,
              new t.MeshStandardMaterial({
                color: a.color,
                map: a.map,
                vertexColors: a.vertexColors,
                alphaTest: a.alphaTest,
                side: a.side,
                roughness: 1,
                metalness: 0,
              }),
            ),
            (le.material = R.get(a)));
        }
      }),
      re
    );
  }),
  (globalThis.MoulinBirds = function (t, n) {
    const { model: A, standard: re, waterLevel: R, inside: he, pond: te, islands: O = [] } = n,
      T = new t.Group();
    ((T.name = "Cortege_du_cygne_et_des_oies"), A.add(T));
    const le = re("#d8d9d0", { roughness: 0.93 }),
      X = re("#c5cbbc", { roughness: 1 }),
      a = re("#89887a", { roughness: 0.94 }),
      _e = re("#403f35", { roughness: 0.96 }),
      pe = re("#d99b38", { roughness: 0.8 }),
      q = re("#191d1c"),
      v = re("#255d48", { roughness: 0.48, metalness: 0.13 });
    function k(M, ee, ge, ae, de, oe) {
      const y = new t.Mesh(ee, ge);
      return (
        y.position.set(...ae),
        y.scale.set(...de),
        (y.castShadow = !0),
        (y.receiveShadow = !0),
        (y.name = oe),
        M.add(y),
        y
      );
    }
    const h = new t.SphereGeometry(1, 12, 8);
    function b(M, ee, ge, ae) {
      return k(
        M,
        new t.TubeGeometry(new t.CatmullRomCurve3(ee.map((de) => new t.Vector3(...de))), 16, ge, 6, !1),
        ae,
        [0, 0, 0],
        [1, 1, 1],
        "Cou",
      );
    }
    function p(M) {
      M.updateMatrixWorld(!0);
      const ee = new Map();
      for (const ge of M.children) (ee.has(ge.material) || ee.set(ge.material, []), ee.get(ge.material).push(ge));
      for (const [ge, ae] of ee) {
        if (ae.length < 2) continue;
        const de = [],
          oe = [],
          y = [],
          I = new t.Vector3(),
          Be = new t.Matrix3();
        let Se = 0;
        for (const E of ae) {
          (E.updateMatrix(), Be.getNormalMatrix(E.matrix));
          const Y = E.geometry,
            w = Y.attributes.position,
            be = Y.attributes.normal;
          for (let ne = 0; ne < w.count; ne++)
            (I.fromBufferAttribute(w, ne).applyMatrix4(E.matrix),
              de.push(I.x, I.y, I.z),
              I.fromBufferAttribute(be, ne).applyMatrix3(Be).normalize(),
              oe.push(I.x, I.y, I.z));
          if (Y.index) for (const ne of Y.index.array) y.push(Se + ne);
          else for (let ne = 0; ne < w.count; ne++) y.push(Se + ne);
          ((Se += w.count), M.remove(E));
        }
        const N = new t.BufferGeometry();
        (N.setAttribute("position", new t.Float32BufferAttribute(de, 3)),
          N.setAttribute("normal", new t.Float32BufferAttribute(oe, 3)),
          N.setIndex(y),
          N.computeBoundingSphere());
        const Ie = new t.Mesh(N, ge);
        ((Ie.name = ae
          .map((E) => E.name)
          .filter((E, Y, w) => w.indexOf(E) === Y)
          .join("_")),
          (Ie.castShadow = Ie.receiveShadow = !0),
          M.add(Ie));
      }
    }
    function S(M, ee) {
      const ge = M === "swan",
        ae = M === "duck",
        de = M === "grey",
        oe = new t.Group();
      ((oe.name = ge ? "Cygne_blanc" : ae ? "Canard_a_collier_blanc" : de ? "Oie_cendree" : "Oie_blanche_" + ee),
        T.add(oe));
      const y = de ? a : ae ? re("#8d8b7c") : le,
        I = ge ? 1.28 : ae ? 0.53 : 0.8,
        Be = ge ? 0.45 : ae ? 0.22 : 0.31;
      k(oe, h, y, [0, ge ? 0.22 : 0.16, 0], [Be, ge ? 0.33 : ae ? 0.17 : 0.24, I * 0.52], "Corps");
      for (const w of [-1, 1]) {
        const be = k(
          oe,
          h,
          de ? a : ae ? _e : X,
          [w * Be * 0.66, ge ? 0.35 : 0.22, -0.03],
          [Be * 0.48, ge ? 0.21 : 0.115, I * 0.4],
          "Aile",
        );
        be.rotation.z = w * 0.13;
        for (let ne = 0; ne < 3; ne++) {
          const K = k(
            oe,
            h,
            de ? (ne % 2 ? X : a) : ae ? a : X,
            [w * (Be * 0.78 - ne * 0.018), (ge ? 0.4 : 0.27) - ne * 0.02, -I * 0.2 + ne * 0.1],
            [Be * 0.24, 0.035, I * 0.23],
            "Plume",
          );
          K.rotation.y = w * 0.2;
        }
      }
      const Se = ge ? 1.18 : ae ? 0.42 : 0.7,
        N = ge ? 0.51 : ae ? 0.27 : 0.43,
        Ie = ae ? v : de ? a : le;
      (ge
        ? b(
            oe,
            [
              [0, 0.24, 0.4],
              [0, 0.48, 0.61],
              [0, 0.76, 0.39],
              [0, 1, 0.35],
              [0, 1.16, 0.49],
            ],
            0.089,
            le,
          )
        : ae
          ? (b(
              oe,
              [
                [0, 0.16, 0.15],
                [0, 0.28, 0.21],
                [0, 0.38, 0.25],
              ],
              0.1,
              v,
            ),
            b(
              oe,
              [
                [0, 0.28, 0.205],
                [0, 0.305, 0.22],
              ],
              0.106,
              le,
            ))
          : b(
              oe,
              [
                [0, 0.2, 0.22],
                [0, 0.38, 0.33],
                [0, 0.58, 0.34],
                [0, 0.7, 0.43],
              ],
              0.085,
              de ? a : le,
            ),
        k(oe, h, Ie, [0, Se, N], [ge ? 0.13 : ae ? 0.115 : 0.12, ge ? 0.135 : 0.105, 0.16], "Tete"));
      const E = k(
        oe,
        new t.ConeGeometry(1, 1, 10),
        pe,
        [0, Se - 0.025, N + 0.19],
        [ae ? 0.075 : 0.065, 0.2, ae ? 0.045 : 0.065],
        "Bec",
      );
      ((E.rotation.x = Math.PI / 2),
        ge && k(oe, h, q, [0, Se + 0.008, N + 0.135], [0.088, 0.07, 0.04], "Masque_du_cygne"));
      for (const w of [-1, 1])
        k(oe, h, q, [w * (ae ? 0.097 : 0.112), Se + 0.025, N + 0.057], [0.018, 0.018, 0.018], "Oeil");
      const Y = k(
        oe,
        new t.ConeGeometry(1, 1, 8),
        ae ? _e : y,
        [0, 0.2, -I * 0.49],
        [Be * 0.56, I * 0.36, 0.1],
        "Queue",
      );
      return ((Y.rotation.x = -Math.PI / 2), p(oe), oe);
    }
    const x = 200,
      c = 75,
      P = 105,
      C = (M, ee, ge) => Math.max(ee, Math.min(ge, M)),
      Ne = (M, ee, ge) => M + (ee - M) * ge,
      z = (M) => M * M * (3 - 2 * M),
      ce = (M, ee) => ((M % ee) + ee) % ee,
      V = n.terrainHeight || (() => R + 0.1),
      Me = n.millPosition || [0, 0],
      je = ["swan", "white", "white", "white", "white", "grey"],
      lt = new t.CylinderGeometry(0.018, 0.022, 0.22, 5),
      Ke = new t.BoxGeometry(0.085, 0.022, 0.16),
      ve = je.map((M, ee) => {
        const ge = S(M, ee),
          ae = new t.Group();
        ae.name = "Plumage";
        for (const oe of [...ge.children]) ae.add(oe);
        ge.add(ae);
        const de = [];
        for (const oe of [-1, 1]) {
          const y = new t.Group();
          ((y.name = "Patte"),
            y.position.set(oe * (ee ? 0.12 : 0.18), -0.11, 0.07),
            k(y, lt, pe, [0, -0.1, 0], [1, 1, 1], "Tarse"),
            k(y, Ke, pe, [0, -0.2, 0.055], [ee ? 1 : 1.25, 1, ee ? 1 : 1.25], "Palme"),
            ge.add(y),
            de.push(y));
        }
        return { mesh: ge, body: ae, legs: de, kind: M, lag: [0, 1.8, 3, 4.2, 5.4, 6.6][ee], side: 0 };
      });
    function qe(M) {
      return O.some((ee) => he(M, ee));
    }
    function Xe(M) {
      return he(M, te) && !qe(M);
    }
    function _t(M, ee, ge) {
      const ae = ge[0] - ee[0],
        de = ge[1] - ee[1],
        oe = C(((M[0] - ee[0]) * ae + (M[1] - ee[1]) * de) / (ae * ae + de * de || 1), 0, 1);
      return Math.hypot(M[0] - ee[0] - ae * oe, M[1] - ee[1] - de * oe);
    }
    function Mt(M, ee) {
      let ge = 1 / 0;
      for (let ae = 0; ae < ee.length; ae++) ge = Math.min(ge, _t(M, ee[ae], ee[(ae + 1) % ee.length]));
      return ge;
    }
    function st(M, ee = 0.36) {
      return Xe(M) && Mt(M, te) >= ee && O.every((ge) => Mt(M, ge) >= ee);
    }
    function $(M) {
      if (he(M, te) || qe(M) || (n.wetAt && n.wetAt(M, 0))) return !1;
      const ee = V(...M);
      return !(
        !Number.isFinite(ee) ||
        ee < R - 0.12 ||
        ee > R + 0.9 ||
        (n.foundationFootprints &&
          n.footprintDistance &&
          n.foundationFootprints.some((ge) => n.footprintDistance(M[0], M[1], ge) < 1.2))
      );
    }
    function U(M, ee, ge = 0.2) {
      const ae = Math.max(2, Math.ceil(Math.hypot(ee[0] - M[0], ee[1] - M[1]) / 0.35));
      for (let de = 0; de <= ae; de++) {
        const oe = de / ae;
        if (!st([Ne(M[0], ee[0], oe), Ne(M[1], ee[1], oe)], ge)) return !1;
      }
      return !0;
    }
    const He = n.waterHome || [-34, 56];
    let Ce = 9,
      xe = 6,
      H = He.slice();
    for (let M = 0; M < 16; M++) {
      let ee = !0;
      for (let ge = 0; ge < 128; ge++) {
        const ae = Math.PI + (ge * Math.PI) / 64;
        if (!st([H[0] + Math.cos(ae) * Ce, H[1] + Math.sin(ae) * xe], 0.8)) {
          ee = !1;
          break;
        }
      }
      if (ee) break;
      ((Ce *= 0.9), (xe *= 0.9));
    }
    function W(M, ee, ge, ae) {
      const de = Math.PI + ae * Math.PI * 2;
      return [M[0] + Math.cos(de) * ee, M[1] + Math.sin(de) * ge];
    }
    const D = new t.CatmullRomCurve3(
        Array.from({ length: 40 }, (M, ee) => {
          const ge = W(H, Ce, xe, ee / 40);
          return new t.Vector3(ge[0], R, ge[1]);
        }),
        !0,
        "centripetal",
      ),
      De = D.getLength();
    function ke(M, ee) {
      const ge = D.getPointAt(ce(M / 60 - ve[ee].lag / De, 1));
      return [ge.x, ge.z];
    }
    const rt = n.shoreHint || [-53, 49],
      $e = [];
    for (let M = 0; M < te.length; M++) {
      const ee = te[M],
        ge = te[(M + 1) % te.length],
        ae = Math.hypot(ge[0] - ee[0], ge[1] - ee[1]);
      if (ae < 0.01) continue;
      const de = [(ge[0] - ee[0]) / ae, (ge[1] - ee[1]) / ae],
        oe = [(ee[0] + ge[0]) / 2, (ee[1] + ge[1]) / 2];
      let y = [de[1], -de[0]];
      he([oe[0] + y[0] * 0.15, oe[1] + y[1] * 0.15], te) && (y = y.map((N) => -N));
      const I = [Me[0] - oe[0], Me[1] - oe[1]];
      if (y[0] * I[0] + y[1] * I[1] > 0) continue;
      const Be = [];
      let Se = !0;
      for (let N = 0; N < 6 && Se; N++) {
        const Ie = (N - 2.5) * 0.91,
          E = [oe[0] + de[0] * Ie, oe[1] + de[1] * Ie];
        let Y = -2,
          w = 2;
        const be = (Ee) => [E[0] + y[0] * Ee, E[1] + y[1] * Ee];
        if (!Xe(be(Y)) || !$(be(w))) {
          Se = !1;
          break;
        }
        for (let Ee = 0; Ee < 20; Ee++) {
          const bt = (Y + w) / 2;
          he(be(bt), te) ? (Y = bt) : (w = bt);
        }
        const ne = be(w + 1e-4),
          K = be(Y - 1.4),
          fe = be(w + 1.65);
        if (!st(K, 0.5) || !$(fe) || Math.abs(V(...fe) - V(...be(w + 0.6))) > 0.48) {
          Se = !1;
          break;
        }
        for (let Ee = 1; Ee <= 18; Ee++) {
          const bt = Ee / 18,
            mt = [
              ne[0] + y[0] * 1.65 * Math.sin(Math.PI * bt) + de[0] * 0.18 * Math.sin(Math.PI * 2 * bt),
              ne[1] + y[1] * 1.65 * Math.sin(Math.PI * bt) + de[1] * 0.18 * Math.sin(Math.PI * 2 * bt),
            ];
          if (!$(mt)) {
            Se = !1;
            break;
          }
        }
        Be.push({ shore: ne, inner: K, dry: fe, normal: y, tangent: de });
      }
      Se &&
        $e.push({
          lanes: Be,
          score: Math.hypot(oe[0] - rt[0], oe[1] - rt[1]) + Math.hypot(oe[0] - H[0], oe[1] - H[1]) * 0.18,
          center: oe,
        });
    }
    $e.sort((M, ee) => M.score - ee.score);
    const B = $e[0];
    let F = null;
    function g() {
      if (F) return F;
      const M = 1,
        ee = Math.floor(Math.min(...te.map((y) => y[0]))),
        ge = Math.floor(Math.min(...te.map((y) => y[1]))),
        ae = Math.ceil(Math.max(...te.map((y) => y[0])) - ee) + 1,
        de = Math.ceil(Math.max(...te.map((y) => y[1])) - ge) + 1,
        oe = new Uint8Array(ae * de);
      for (let y = 0; y < de; y++) for (let I = 0; I < ae; I++) oe[y * ae + I] = st([ee + I, ge + y], 0.45) ? 1 : 0;
      return (F = { step: M, minX: ee, minZ: ge, nx: ae, nz: de, valid: oe });
    }
    function G(M, ee) {
      if (U(M, ee)) return [M, ee];
      const ge = g(),
        ae = (Y) => [ge.minX + (Y % ge.nx), ge.minZ + Math.floor(Y / ge.nx)];
      function de(Y) {
        let w = -1,
          be = 1 / 0;
        for (let ne = 0; ne < ge.valid.length; ne++)
          if (ge.valid[ne]) {
            const K = ae(ne),
              fe = Math.hypot(K[0] - Y[0], K[1] - Y[1]);
            fe < be && U(Y, K, 0.18) && ((be = fe), (w = ne));
          }
        return w;
      }
      const oe = de(M),
        y = de(ee);
      if (oe < 0 || y < 0) throw Error("Aucun passage s\xFBr pour les oies");
      const I = new Set([oe]),
        Be = new Int32Array(ge.valid.length).fill(-1),
        Se = new Float64Array(ge.valid.length).fill(1 / 0);
      Se[oe] = 0;
      let N = !1;
      for (; I.size; ) {
        let Y = -1,
          w = 1 / 0;
        for (const K of I) {
          const fe = ae(K),
            Ee = Se[K] + Math.hypot(fe[0] - ee[0], fe[1] - ee[1]);
          Ee < w && ((w = Ee), (Y = K));
        }
        if (Y === y) {
          N = !0;
          break;
        }
        I.delete(Y);
        const be = Y % ge.nx,
          ne = Math.floor(Y / ge.nx);
        for (const [K, fe] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
          [1, 1],
          [-1, 1],
          [1, -1],
          [-1, -1],
        ]) {
          const Ee = be + K,
            bt = ne + fe,
            mt = bt * ge.nx + Ee;
          if (
            Ee < 0 ||
            bt < 0 ||
            Ee >= ge.nx ||
            bt >= ge.nz ||
            !ge.valid[mt] ||
            (K && fe && (!ge.valid[ne * ge.nx + Ee] || !ge.valid[bt * ge.nx + be]))
          )
            continue;
          const Ct = Se[Y] + Math.hypot(K, fe);
          Ct < Se[mt] && ((Se[mt] = Ct), (Be[mt] = Y), I.add(mt));
        }
      }
      if (!N) throw Error("Parcours des oies interrompu par une \xEEle");
      const Ie = [ee];
      for (let Y = y; Y !== oe; Y = Be[Y]) Ie.push(ae(Y));
      (Ie.push(ae(oe), M), Ie.reverse());
      const E = [Ie[0]];
      for (let Y = 0; Y < Ie.length - 1; ) {
        let w = Ie.length - 1;
        for (; w > Y + 1 && !U(Ie[Y], Ie[w], 0.28); ) w--;
        (E.push(Ie[w]), (Y = w));
      }
      return E;
    }
    function Qe(M) {
      const ee = [0];
      for (let ae = 1; ae < M.length; ae++)
        ee.push(ee[ae - 1] + Math.hypot(M[ae][0] - M[ae - 1][0], M[ae][1] - M[ae - 1][1]));
      const ge = ee.at(-1);
      return {
        points: M,
        length: ge,
        at(ae) {
          const de = C(ae, 0, 1) * ge;
          let oe = 1;
          for (; oe < ee.length - 1 && de > ee[oe]; ) oe++;
          const y = (de - ee[oe - 1]) / (ee[oe] - ee[oe - 1] || 1);
          return [Ne(M[oe - 1][0], M[oe][0], y), Ne(M[oe - 1][1], M[oe][1], y)];
        },
      };
    }
    const Fe = Array.from({ length: 3 }, (M, ee) => {
      const ge = ke(ee * 20 + 9, 0);
      let ae = 2.4,
        de = 1.65;
      for (
        let oe = 0;
        oe < 15 && !Array.from({ length: 64 }, (y, I) => W(ge, ae, de, I / 64)).every((y) => st(y, 0.65));
        oe++
      )
        ((ae *= 0.87), (de *= 0.87));
      return { center: ge, rx: ae, rz: de, length: Math.PI * 2 * Math.sqrt((ae * ae + de * de) / 2) };
    });
    function Le(M, ee) {
      const ge = Fe[Math.floor(ee / 2)];
      return W(ge.center, ge.rx, ge.rz, M - ((ee % 2) * 1.25) / ge.length);
    }
    const pt = [],
      Ge = [],
      m = [],
      at = [];
    for (let M = 0; M < 6; M++) {
      if (B) {
        const ee = B.lanes[M];
        (pt.push(Qe([...G(ke(0, M), ee.inner), ee.shore])), Ge.push(Qe([ee.shore, ...G(ee.inner, ke(0, M))])));
      }
      (m.push(Qe(G(ke(20, M), Le(0, M)))), at.push(Qe(G(Le(0, M), ke(0, M)))));
    }
    function ft(M) {
      const ee = ce(M, x),
        ge = !!B && ee >= c && ee < P;
      return {
        cycleSeconds: x,
        phase: ee,
        social: ee < 140 ? "flock" : "pairs",
        grouped: ee < 140,
        pairs:
          ee >= 140
            ? [
                [0, 1],
                [2, 3],
                [4, 5],
              ]
            : [],
        surface: ge ? "bank" : "water",
        ashore: ge,
        transition:
          ee >= 60 && ee < 75
            ? "landing"
            : ee >= 105 && ee < 120
              ? "returning"
              : ee >= 140 && ee < 160
                ? "separating"
                : ee >= 180
                  ? "regrouping"
                  : null,
        planned: {
          flockSeconds: 140,
          pairsSeconds: 60,
          shoreSeconds: B ? 30 : 0,
          flockRatio: 0.7,
          pairsRatio: 0.3,
          shoreRatio: B ? 0.15 : 0,
        },
        landingAvailable: !!B,
      };
    }
    function ue(M, ee) {
      const ge = ce(M, x);
      if (ge < 60) return ke(ge, ee);
      if (ge < 75) return B ? pt[ee].at(z((ge - 60) / 15)) : ke(ge - 60, ee);
      if (ge < 105) {
        if (!B) return ke(ge - 60, ee);
        const ae = B.lanes[ee],
          de = (ge - 75) / 30,
          oe = 1.65 * Math.sin(Math.PI * de),
          y = 0.18 * Math.sin(Math.PI * 2 * de);
        return [
          ae.shore[0] + ae.normal[0] * oe + ae.tangent[0] * y,
          ae.shore[1] + ae.normal[1] * oe + ae.tangent[1] * y,
        ];
      }
      return ge < 120
        ? B
          ? Ge[ee].at(z((ge - 105) / 15))
          : ke(ge - 60, ee)
        : ge < 140
          ? ke(ge - 120, ee)
          : ge < 160
            ? m[ee].at(z((ge - 140) / 20))
            : ge < 180
              ? Le((ge - 160) / 20, ee)
              : at[ee].at(z((ge - 180) / 20));
    }
    function se(M, ee) {
      const ge = ue(M, ee),
        ae = ue(M - 0.045, ee),
        de = ue(M + 0.045, ee),
        oe = new t.Vector3(de[0] - ae[0], 0, de[1] - ae[1]),
        y = oe.length() / 0.09;
      oe.normalize();
      const I = ft(M),
        Be = V(...ge),
        Se = C((Be - R + 0.16) / 0.26, 0, 1),
        N = Math.max(R, Be + 0.27 * Se);
      return { p: new t.Vector3(ge[0], N, ge[1]), v: oe, speed: y, stand: Se, state: I, ground: Be };
    }
    const Ve = new t.MeshBasicMaterial({
        color: "#d4dfd5",
        transparent: !0,
        opacity: 0.18,
        depthWrite: !1,
        side: t.DoubleSide,
      }),
      vt = new t.RingGeometry(0.29, 0.31, 20, 1, Math.PI * 0.08, Math.PI * 0.84),
      me = [];
    for (let M = 0; M < 6; M++) {
      const ee = new t.Group();
      ((ee.name = "Sillage_" + M), T.add(ee), me.push(ee));
      for (let ge = 0; ge < 2; ge++) {
        const ae = new t.Mesh(vt, Ve);
        ((ae.rotation.x = -Math.PI / 2),
          ae.scale.set(1 + ge * 0.65, 1.7 + ge * 0.85, 1),
          ae.position.set(0, 0.012, -0.36 - ge * 0.32),
          ee.add(ae));
      }
    }
    let Re = null;
    function et(M) {
      const ee = Re === null ? 0.033 : C(M - Re, 0, 0.15);
      ((Re = M),
        ve.forEach((ge, ae) => {
          const de = se(M, ae),
            oe = de.stand,
            y = Math.min(de.speed / 0.3, 1),
            I = M * 7 + ae * 0.9;
          if (
            (ge.mesh.position.copy(de.p),
            (ge.body.position.y =
              Math.sin(M * 1.65 + ae * 0.7) * 0.009 * (1 - oe) + Math.abs(Math.sin(I)) * 0.014 * oe * y),
            (ge.body.rotation.z = Math.sin(M * 1.2 + ae) * 0.015 * (1 - oe) + Math.sin(I) * 0.025 * oe * y),
            de.v.lengthSq() > 0.001)
          ) {
            const Be = Math.atan2(de.v.x, de.v.z),
              Se = ce(Be - ge.mesh.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
            ge.mesh.rotation.y += Se * Math.min(1, ee * 7);
          }
          (ge.legs.forEach((Be, Se) => {
            Be.visible = oe > 0.1;
            const N = Math.sin(I + Se * Math.PI) * y;
            ((Be.rotation.x = N * 0.3 * oe), (Be.position.z = 0.06 + N * 0.055 * oe));
            const Ie = ge.mesh.rotation.y,
              E = Be.position.x,
              Y = Be.position.z + 0.055,
              w = de.p.x + E * Math.cos(Ie) + Y * Math.sin(Ie),
              be = de.p.z - E * Math.sin(Ie) + Y * Math.cos(Ie),
              ne = Math.max(R - 0.18, V(w, be));
            Be.position.y = C(ne - de.p.y + 0.21, -0.21, 0.06) + Math.max(0, N) * 0.035 * oe;
          }),
            (me[ae].visible = oe < 0.2 && !de.state.ashore),
            me[ae].position.set(de.p.x, R + 0.012, de.p.z),
            (me[ae].rotation.y = ge.mesh.rotation.y));
        }));
    }
    function kt(M = 0.25) {
      const ee = [],
        ge = { flock: 0, pairs: 0, shore: 0 };
      let ae = 0,
        de = 0,
        oe = 0,
        y = 0;
      const I = ve.map((Be, Se) => se(-M, Se).p);
      for (let Be = 0; Be < Math.ceil(x / M); Be++) {
        const Se = Be * M,
          N = Math.min(M, x - Se),
          Ie = ft(Se + N * 0.5);
        ((ge[Ie.social] += N), Ie.ashore && (ge.shore += N));
        for (let E = 0; E < 6; E++) {
          const Y = se(Se, E),
            w = [Y.p.x, Y.p.z];
          (!(Ie.ashore ? $(w) : Xe(w) || (!!B && Mt(w, te) < 0.025)) &&
            ee.length < 30 &&
            ee.push({ time: Se, bird: E, x: w[0], z: w[1], surface: Ie.surface }),
            Ie.ashore && y++,
            (ae = Math.max(ae, Y.speed)),
            (de = Math.max(de, Y.p.distanceTo(I[E]))),
            (oe = Math.max(oe, Math.abs(Y.p.y - I[E].y))),
            I[E].copy(Y.p));
        }
      }
      for (const Be of Object.keys(ge)) ge[Be] = Math.round(ge[Be] * 1e8) / 1e8;
      return {
        valid: ee.length === 0 && !!B,
        count: ve.length,
        kinds: je,
        invalid: ee,
        durations: ge,
        ratios: { flock: ge.flock / x, pairs: ge.pairs / x, shore: ge.shore / x },
        shoreSamples: y,
        landing: B ? { center: B.center, lanes: B.lanes.map((Be) => ({ shore: Be.shore, dry: Be.dry })) } : null,
        maxSpeed: ae,
        maxStep: de,
        maxVerticalStep: oe,
        step: M,
      };
    }
    return (
      et(0),
      {
        group: T,
        birds: ve,
        wakes: me,
        update: et,
        sample: se,
        validateRoute: kt,
        validateRoutes: kt,
        getBehaviorState: ft,
        length: De,
        period: x,
        landing: (B == null ? void 0 : B.center) || null,
      }
    );
  }),
  (globalThis.MoulinRenderCache = function (t, { model: n, terrainData: A }) {
    const re = new t.Group();
    ((re.name = "Rendu_spatial"), (re.userData.exportSkip = !0), n.add(re));
    const R = [],
      he = [],
      te = { originalDraws: 0, batchedDraws: 0 };
    function O(h, b) {
      const p = h.attributes.position,
        S = new t.Box3(),
        x = new t.Vector3();
      for (const c of b) S.expandByPoint(x.fromBufferAttribute(p, c));
      ((h.boundingBox = S),
        (h.boundingSphere = S.getBoundingSphere(new t.Sphere())),
        (h.boundingSphere.radius += 12),
        h.boundingBox.expandByScalar(12));
    }
    function T(h, b) {
      const p = new t.BufferGeometry();
      for (const S of Object.keys(h.attributes)) p.setAttribute(S, h.attributes[S]);
      return (p.setIndex(b), O(p, b), p);
    }
    function le(h) {
      ((h.visible = !1), (h.userData.renderSource = !0));
    }
    const X = A.mesh,
      a = X.geometry,
      _e = new Map();
    for (const h of A.renderCells) {
      const b = Math.floor(h.x / 40) + ":" + Math.floor(h.z / 40);
      let p = _e.get(b);
      p || ((p = { fine: [], coarse: [] }), _e.set(b, p));
      for (let S = h.start; S < h.end; S++) p.fine.push(a.index.array[S]);
      p.coarse.push(...h.coarse);
    }
    for (const [h, b] of _e) {
      const p = T(a, b.fine),
        S = new t.Mesh(p, X.material);
      ((S.name = "Sol_" + h),
        (S.receiveShadow = !0),
        (S.castShadow = !1),
        (S.userData.renderTile = !0),
        re.add(S),
        he.push({
          mesh: S,
          fine: p.index,
          coarse: new t.BufferAttribute(new Uint32Array(b.coarse), 1),
          fineIDs: b.fine,
        }));
    }
    (le(X), (A.refreshRenderBounds = () => {}));
    const pe = n.getObjectByName("Brins_d_herbe_des_jardins");
    if (pe) {
      const h = pe.geometry,
        b = new Map(),
        p = h.attributes.position;
      for (let S = 0; S < h.index.count; S += 3) {
        const x = [h.index.array[S], h.index.array[S + 1], h.index.array[S + 2]],
          c = x[0],
          P = Math.floor(p.getX(c) / 8) + ":" + Math.floor(p.getZ(c) / 8);
        (b.has(P) || b.set(P, []), b.get(P).push(...x));
      }
      for (const [S, x] of b) {
        const c = T(h, x),
          P = new t.Mesh(c, pe.material);
        ((P.name = "Herbe_" + S),
          (P.receiveShadow = !0),
          (P.castShadow = !1),
          (P.userData.renderTile = !0),
          re.add(P),
          R.push(P));
      }
      ((pe.refreshRenderBounds = () => {}), le(pe));
    }
    n.updateMatrixWorld(!0);
    const q = [];
    n.traverse((h) => {
      if (
        !h.isMesh ||
        !h.visible ||
        h.isInstancedMesh ||
        h.userData.isWater ||
        Array.isArray(h.material) ||
        h.material.transparent ||
        !h.geometry.attributes.normal
      )
        return;
      let b = h;
      for (; b; ) {
        if (
          b.userData.editableNativePath21 ||
          b.userData.dynamic25 ||
          b.userData.dynamicWater20 ||
          b === re ||
          b.name === "Boisements" ||
          b.name === "Cortege_du_cygne_et_des_oies" ||
          b.name === "Berges_et_sous_bois_low_poly" ||
          b.name === "Sentiers_et_berges_v16"
        )
          return;
        b = b.parent;
      }
      q.push(h);
    });
    const v = new Map();
    for (const h of q) {
      const b = new t.Vector3().setFromMatrixPosition(h.matrixWorld),
        S =
          h.material.uuid +
          ":" +
          Math.floor(b.x / 48) +
          ":" +
          Math.floor(b.z / 48) +
          ":" +
          h.castShadow +
          ":" +
          h.receiveShadow;
      (v.has(S) || v.set(S, []), v.get(S).push(h));
    }
    for (const h of v.values()) {
      if (h.length < 2) continue;
      const b = [],
        p = [],
        S = [],
        x = [],
        c = [],
        P = new t.Vector3(),
        C = new t.Matrix3();
      let Ne = 0;
      for (const V of h) {
        const Me = V.geometry,
          je = Me.attributes.position,
          lt = Me.attributes.normal,
          Ke = Me.attributes.uv,
          ve = Me.attributes.color;
        C.getNormalMatrix(V.matrixWorld);
        for (let qe = 0; qe < je.count; qe++)
          (P.fromBufferAttribute(je, qe).applyMatrix4(V.matrixWorld),
            b.push(P.x, P.y, P.z),
            P.fromBufferAttribute(lt, qe).applyMatrix3(C).normalize(),
            p.push(P.x, P.y, P.z),
            S.push(Ke ? Ke.getX(qe) : 0, Ke ? Ke.getY(qe) : 0),
            x.push(ve ? ve.getX(qe) : 1, ve ? ve.getY(qe) : 1, ve ? ve.getZ(qe) : 1));
        if (Me.index) for (const qe of Me.index.array) c.push(qe + Ne);
        else for (let qe = 0; qe < je.count; qe++) c.push(qe + Ne);
        ((Ne += je.count), le(V));
      }
      const z = new t.BufferGeometry();
      (z.setAttribute("position", new t.Float32BufferAttribute(b, 3)),
        z.setAttribute("normal", new t.Float32BufferAttribute(p, 3)),
        z.setAttribute("uv", new t.Float32BufferAttribute(S, 2)),
        h[0].material.vertexColors && z.setAttribute("color", new t.Float32BufferAttribute(x, 3)),
        z.setIndex(c),
        z.computeBoundingSphere());
      const ce = new t.Mesh(z, h[0].material);
      ((ce.name = "Details_groupes_" + te.batchedDraws),
        (ce.castShadow = h[0].castShadow),
        (ce.receiveShadow = h[0].receiveShadow),
        re.add(ce),
        (te.originalDraws += h.length),
        te.batchedDraws++);
    }
    A.renderCells = null;
    function k(h, b) {
      const p = b === "detail" ? 35 : b === "fast" ? 14 : 23;
      for (const S of he) S.mesh.geometry.index = S.fine;
      for (const S of R)
        S.visible = h.distanceTo(S.geometry.boundingSphere.center) < p + S.geometry.boundingSphere.radius;
    }
    return { update: k, stats: te, grassTiles: R, terrainTiles: he };
  }),
  (globalThis.MoulinEditor = function (t, n) {
    var ct, gt, Gt, Ot, Xt, Wt;
    const {
        root: A,
        mount: re,
        model: R,
        camera: he,
        controls: te,
        renderer: O,
        forest: T,
        terrainData: le,
        terrainHeight: X,
        ground: a,
        bounds: _e,
        inside: pe,
        wetAt: q,
        yard: v,
        patio: k,
        pointGarden: h,
        standard: b,
        surfaces: p,
        selectView: S,
        cameraSupportHeight: x,
      } = n,
      c = (i) => A.querySelector(i),
      P = (i) => [...A.querySelectorAll(i)],
      C = O.domElement,
      Ne = t.MathUtils.clamp,
      z = "moulin-landscape-v9",
      ce = [],
      V = [],
      Me = new Set(),
      je = new t.Raycaster(),
      lt = new t.Vector2(),
      Ke = n.props;
    let ve = null,
      qe = null,
      Xe = Ke.catalog[0].id,
      _t = null,
      Mt = !1;
    const st = ["raise", "lower", "flatten", "smooth", "restore", "ramp", "terrace"];
    let $ = null,
      U = null,
      He = null,
      Ce = null,
      xe = [],
      H = [],
      W = 0;
    const D = (n.propertyTrails || []).filter((i) => {
      var d;
      return ((d = i.points) == null ? void 0 : d.length) > 1;
    });
    let De = 0,
      ke = null,
      rt = !1,
      $e = { holes: [], treasure: 0, opened27: !1 },
      B = Date.now(),
      F = 0,
      g = "orbit",
      G = "select",
      Qe = null,
      Fe = null,
      Le = null,
      pt = null,
      Ge = [],
      m = [],
      at = 0,
      ft = !1,
      ue = 0,
      se = 0,
      Ve = !1,
      vt = null,
      me = new t.Vector3(),
      Re = !1,
      et = null,
      kt = "";
    const M = new t.Group();
    ((M.name = "Reperes_editeur"), (M.userData.editorHelper = !0), (M.visible = !1), R.add(M));
    const ee = new t.BufferGeometry().setFromPoints(
        Array.from(
          { length: 97 },
          (i, d) => new t.Vector3(Math.cos((d / 96) * Math.PI * 2), 0, Math.sin((d / 96) * Math.PI * 2)),
        ),
      ),
      ge = new t.Line(ee, new t.LineBasicMaterial({ color: 16043891, depthTest: !1 }));
    ((ge.renderOrder = 90), (ge.visible = !1), M.add(ge));
    const ae = new t.Line(new t.BufferGeometry(), new t.LineBasicMaterial({ color: 15321220, depthTest: !1 }));
    ((ae.renderOrder = 93), (ae.visible = !1), M.add(ae));
    const de = new t.Line(ee.clone(), new t.LineBasicMaterial({ color: 15984837, depthTest: !1 }));
    ((de.renderOrder = 91), (de.visible = !1), M.add(de));
    const oe = new t.Line(new t.BufferGeometry(), new t.LineBasicMaterial({ color: 15187046, depthTest: !1 }));
    ((oe.renderOrder = 92), M.add(oe));
    const y = new t.Line(new t.BufferGeometry(), new t.LineBasicMaterial({ color: 16766845, depthTest: !1 }));
    ((y.renderOrder = 95), (y.visible = !1), M.add(y));
    const I = new t.Group();
    ((I.name = "Sentiers_de_feuilles"), R.add(I));
    const Be = b("#b3a28a", {
        map: p.leafLitter,
        normalMap: p.grassNormal,
        normalScale: new t.Vector2(0.3, 0.3),
        roughness: 1,
        side: t.DoubleSide,
        polygonOffset: !0,
        polygonOffsetFactor: -1,
      }),
      Se = le.mesh.geometry.attributes.position,
      N = le.base,
      Ie = le.values,
      E = new Map(),
      Y = new Map();
    for (let i = 0; i < Se.count; i++) {
      const d = Math.floor(N[i * 3] / 8) + "," + Math.floor(N[i * 3 + 2] / 8);
      (E.has(d) || E.set(d, []), E.get(d).push(i));
    }
    const w = [];
    R.traverse((i) => {
      i.isMesh &&
        i.name === "Brins_d_herbe_des_jardins" &&
        w.push({ mesh: i, base: i.geometry.attributes.position.array.slice() });
    });
    const be = ["Moulin", "Dependance"]
      .map((i) => R.getObjectByName(i))
      .filter(Boolean)
      .map((i) => new t.Box3().setFromObject(i).expandByScalar(0.6));
    function ne(i, d = !1) {
      const Z = c("[data-editor-status]");
      ((Z.textContent = i), (Z.dataset.error = String(d)));
    }
    function K(i, d) {
      return (
        Number.isFinite(i) &&
        Number.isFinite(d) &&
        i > _e.x0 + 2 &&
        i < _e.x1 - 2 &&
        d > _e.z0 + 2 &&
        d < _e.z1 - 2 &&
        (!q([i, d], 0.45) || n.islands.some((Z) => pe([i, d], Z)))
      );
    }
    function fe(i, d) {
      if (
        n.protectedSite(i, d) ||
        q([i, d], 0.65) ||
        n.foundationFootprints.some((ie) => n.footprintDistance(i, d, ie) < 1.6) ||
        pe([i, d], n.rearBed)
      )
        return !1;
      const Z = n.rearWallSample(i, d);
      if (
        (Z.along > -0.5 && Z.along < Z.length + 0.5 && Math.abs(Z.side) < 0.85) ||
        !K(i, d) ||
        n.islands.some((ie) => pe([i, d], ie)) ||
        pe([i, d], v) ||
        pe([i, d], k) ||
        pe([i, d], h) ||
        be.some((ie) => i > ie.min.x && i < ie.max.x && d > ie.min.z && d < ie.max.z)
      )
        return !1;
      const ye = i * Math.cos(0.24) - d * Math.sin(0.24),
        nt = i * Math.sin(0.24) + d * Math.cos(0.24);
      if (Math.abs(ye) < 5 && Math.abs(nt) < 8) return !1;
      const xt = i + 19.44,
        ot = d - 6.21,
        tt = Math.PI / 2 - 0.04,
        l = xt * Math.cos(tt) - ot * Math.sin(tt),
        j = xt * Math.sin(tt) + ot * Math.cos(tt);
      return !(Math.abs(l) < 4 && j > -12 && j < 8);
    }
    function Ee(i = !0) {
      return {
        version: 27,
        holes: $e.holes.map((d) => {
          var Z;
          return i
            ? { ...d, changes: (Z = d.changes) == null ? void 0 : Z.map((ye) => ye.slice()) }
            : { x: d.x, z: d.z, depth: d.depth, seed: d.seed };
        }),
        treasure: $e.treasure,
        opened27: $e.opened27 === !0,
      };
    }
    function bt() {
      var d, Z, ye;
      const i = [];
      for (let nt = 0; nt < Se.count; nt++) {
        const xt = Ie[nt * 3 + 1] - N[nt * 3 + 1];
        Math.abs(xt) > 5e-5 && i.push([nt, +xt.toFixed(5)]);
      }
      return {
        gardenDetails29: 1,
        shorelines29: ((d = n.shore29) == null ? void 0 : d.exportContours()) || [],
        gardenVersion25: 1,
        adventure24: Ee(),
        vehicleParking24:
          ((ye = (Z = n.player) == null ? void 0 : Z.exportParking24) == null ? void 0 : ye.call(Z)) || [],
        worldVersion: 29,
        hiddenPaths: [...xe],
        ecologyCuts: H.map((nt) => ({ id: nt.id, cells: nt.cells.map((xt) => xt.slice()) })),
        catalogueVersion: 22,
        decorationVersion: 20,
        objects: Ke.exportRecords(),
        format: "moulin-landscape",
        schema: 1,
        baseVersion: 9,
        styleVersion: 17,
        vertexCount: Se.count,
        trees: T.records.map((nt) => ({ ...nt })),
        terrain: i,
        paths: Ge.map((nt) => ({ id: nt.id, width: nt.width, points: nt.points.map((xt) => xt.slice()) })),
      };
    }
    const mt = () => JSON.stringify(bt());
    function Ct(i) {
      var xt;
      if (
        ((xt = n.shore29) == null || xt.validate((i == null ? void 0 : i.shorelines29) || []),
        !i || i.format !== "moulin-landscape" || i.schema !== 1 || i.baseVersion !== 9 || i.vertexCount !== Se.count)
      )
        throw Error("Ce fichier ne correspond pas au projet du moulin, versions 9 \xE0 21.");
      if (
        !Array.isArray(i.trees) ||
        i.trees.length > 8e3 ||
        !Array.isArray(i.terrain) ||
        i.terrain.length > Se.count ||
        !Array.isArray(i.paths) ||
        i.paths.length > 80
      )
        throw Error("Le fichier contient trop d\u2019\xE9l\xE9ments ou une structure invalide.");
      const d = (ot, tt, l) => typeof ot == "number" && Number.isFinite(ot) && ot >= tt && ot <= l,
        Z = new Set();
      for (const ot of i.trees) {
        if (
          !ot ||
          typeof ot.id != "string" ||
          !/^arbre-\d+$/.test(ot.id) ||
          Z.has(ot.id) ||
          !Object.prototype.hasOwnProperty.call(T.species, ot.species) ||
          !d(ot.x, _e.x0, _e.x1) ||
          !d(ot.z, _e.z0, _e.z1) ||
          !d(ot.height, 1, 45) ||
          !d(ot.diameter, 0.05, 3) ||
          !d(ot.spread, 0.35, 2) ||
          !d(ot.rotation, -1e3, 1e3) ||
          !Number.isInteger(ot.variant) ||
          ot.variant < 0 ||
          ot.variant > 3 ||
          typeof ot.label != "string" ||
          ot.label.length > 180
        )
          throw Error("Un arbre du fichier est invalide.");
        Z.add(ot.id);
      }
      const ye = new Set();
      for (const ot of i.terrain) {
        if (
          !Array.isArray(ot) ||
          ot.length !== 2 ||
          !Number.isInteger(ot[0]) ||
          ot[0] < 0 ||
          ot[0] >= Se.count ||
          ye.has(ot[0]) ||
          !d(ot[1], -12, 12)
        )
          throw Error("Une retouche du terrain est invalide.");
        ye.add(ot[0]);
      }
      const nt = new Set();
      for (const ot of i.paths) {
        if (
          !ot ||
          typeof ot.id != "string" ||
          !/^sentier-\d+$/.test(ot.id) ||
          nt.has(ot.id) ||
          !d(ot.width, 0.6, 4) ||
          !Array.isArray(ot.points) ||
          ot.points.length < 2 ||
          ot.points.length > 250 ||
          ot.points.some(
            (tt) => !Array.isArray(tt) || tt.length !== 2 || !d(tt[0], _e.x0, _e.x1) || !d(tt[1], _e.z0, _e.z1),
          )
        )
          throw Error("Un sentier du fichier est invalide.");
        nt.add(ot.id);
      }
      if (i.objects !== void 0) {
        if (!Array.isArray(i.objects) || i.objects.length > 2e3)
          throw Error("Le catalogue est limit\xE9 \xE0 2 000 objets.");
        const ot = new Set();
        for (const tt of i.objects) {
          if (
            !tt ||
            typeof tt.id != "string" ||
            !/^objet-\d+$/.test(tt.id) ||
            ot.has(tt.id) ||
            !Ke.catalog.some((l) => l.id === tt.type) ||
            !d(tt.x, _e.x0, _e.x1) ||
            !d(tt.z, _e.z0, _e.z1) ||
            !d(tt.yOffset, -5, 20) ||
            !d(tt.rotation, -1e3, 1e3) ||
            !d(tt.scale, 0.1, 5) ||
            !Number.isInteger(tt.variant) ||
            tt.variant < 0 ||
            tt.variant > 3
          )
            throw Error("Un objet du catalogue est invalide.");
          if (tt.color !== void 0 && (typeof tt.color != "string" || !/^#[0-9a-f]{6}$/i.test(tt.color)))
            throw Error("Couleur d\u2019objet invalide : utilisez une couleur hexad\xE9cimale \xE0 six caract\xE8res.");
          ot.add(tt.id);
        }
      }
      if (i.vehicleParking24 !== void 0) {
        if (!Array.isArray(i.vehicleParking24) || i.vehicleParking24.length > 16)
          throw Error("Les voitures sauvegard\xE9es sont invalides.");
        const ot = new Set();
        for (const tt of i.vehicleParking24) {
          if (
            !tt ||
            typeof tt.id != "string" ||
            !/^voiture-\d+$/.test(tt.id) ||
            ot.has(tt.id) ||
            !d(tt.x, _e.x0, _e.x1) ||
            !d(tt.z, _e.z0, _e.z1) ||
            !d(tt.rotation, -1e3, 1e3)
          )
            throw Error("La position d\u2019une voiture est invalide.");
          ot.add(tt.id);
        }
      }
      if (i.adventure24 !== void 0) {
        const ot = i.adventure24;
        if (
          !ot ||
          !Array.isArray(ot.holes) ||
          ot.holes.length > 96 ||
          !Number.isInteger(ot.treasure) ||
          ot.treasure < 0 ||
          ot.treasure > 3
        )
          throw Error("Les fouilles sauvegard\xE9es sont invalides.");
        if (ot.opened27 !== void 0 && (typeof ot.opened27 != "boolean" || (ot.opened27 && ot.treasure < 3)))
          throw Error("L\u2019ouverture du coffre sauvegard\xE9 est invalide.");
        for (const tt of ot.holes) {
          if (
            !tt ||
            !d(tt.x, _e.x0, _e.x1) ||
            !d(tt.z, _e.z0, _e.z1) ||
            !d(tt.depth, 0, 1.2) ||
            !Number.isInteger(tt.seed) ||
            tt.seed < 0 ||
            tt.seed > 1e4
          )
            throw Error("Une fouille du fichier est invalide.");
          if (tt.changes !== void 0) {
            const l = new Set();
            if (
              !Array.isArray(tt.changes) ||
              tt.changes.length > 4096 ||
              tt.changes.some(
                (j) =>
                  !Array.isArray(j) ||
                  j.length !== 3 ||
                  !Number.isInteger(j[0]) ||
                  j[0] < 0 ||
                  j[0] >= Se.count ||
                  l.has(j[0]) ||
                  !l.add(j[0]) ||
                  !d(j[1], N[j[0] * 3 + 1] - 12.01, N[j[0] * 3 + 1] + 12.01) ||
                  !d(j[2], N[j[0] * 3 + 1] - 12.01, N[j[0] * 3 + 1] + 12.01) ||
                  Math.abs(j[1] - j[2]) > 1.5,
              ) ||
              !d(tt.expiresAt, 0, 1e14) ||
              (tt.cutId !== void 0 && (typeof tt.cutId != "string" || !/^fouille25-\d+$/.test(tt.cutId)))
            )
              throw Error("La restauration d\u2019une fouille est invalide.");
          }
        }
      }
      if (
        i.hiddenPaths !== void 0 &&
        (!Array.isArray(i.hiddenPaths) ||
          i.hiddenPaths.length > 200 ||
          i.hiddenPaths.some((ot) => typeof ot != "string" || ot.length > 180) ||
          new Set(i.hiddenPaths).size !== i.hiddenPaths.length)
      )
        throw Error("La liste des sentiers masqu\xE9s est invalide.");
      if (i.ecologyCuts !== void 0) {
        if (!Array.isArray(i.ecologyCuts) || i.ecologyCuts.length > 500)
          throw Error("Les zones de v\xE9g\xE9tation retir\xE9e sont invalides.");
        let ot = 0;
        const tt = new Set();
        for (const l of i.ecologyCuts) {
          if (
            !l ||
            typeof l.id != "string" ||
            l.id.length > 80 ||
            tt.has(l.id) ||
            !Array.isArray(l.cells) ||
            l.cells.some(
              (j) =>
                !Array.isArray(j) ||
                j.length !== 3 ||
                !d(j[0], _e.x0, _e.x1) ||
                !d(j[1], _e.z0, _e.z1) ||
                !d(j[2], 0.1, 10),
            )
          )
            throw Error("Une zone de v\xE9g\xE9tation retir\xE9e est invalide.");
          (tt.add(l.id), (ot += l.cells.length));
        }
        if (ot > 5e5) throw Error("Trop de retouches de v\xE9g\xE9tation.");
      }
      return i;
    }
    function Pt() {
      (ke && J(!1), pt === null && (pt = mt()));
    }
    function jt() {
      (clearTimeout(et), (et = null));
      const i = JSON.stringify(ke || bt());
      try {
        (localStorage.setItem(z, i),
          (kt = i),
          (rt = !0),
          f(),
          (c("[data-save-state]").textContent = "Modifications conserv\xE9es dans ce navigateur"));
      } catch {
        c("[data-save-state]").textContent =
          "Sauvegarde du navigateur indisponible. Utilisez \xAB Exporter mes retouches \xBB.";
      }
    }
    function Dt() {
      (clearTimeout(et), (et = setTimeout(jt, 350)));
    }
    function we() {
      ((c("[data-undo]").disabled = ce.length === 0), (c("[data-redo]").disabled = V.length === 0));
    }
    function We() {
      (pt !== null && (mt() !== pt && (ce.push(pt), ce.length > 20 && ce.shift(), (V.length = 0), Dt()), (pt = null)),
        we());
    }
    function yt(i, d) {
      var nt, xt;
      const Z = c("[data-object-color-panel]");
      if (!Z) return;
      if (((Z.hidden = !i || !(d != null && d.colorable)), i && d != null && d.colorable)) {
        const ot = i.color || ((nt = d.variantColors) == null ? void 0 : nt[i.variant]) || d.defaultColor;
        c("[data-object-color]").value = ot;
        const tt = d.colorPalette || ["#b6a58b", "#e7e2d5", "#d0cbbb", "#9b8062", "#838579"],
          l = {
            "#b6a58b": "Beige naturel",
            "#e7e2d5": "Blanc cass\xE9",
            "#d0cbbb": "\xC9cru gris\xE9",
            "#9b8062": "Bois brun",
            "#838579": "Gris pierre",
            "#d990ac": "Fleurs roses",
            "#91b4d8": "Fleurs bleues",
            "#eee6d1": "Fleurs cr\xE8me",
            "#b4a0cb": "Fleurs mauves",
            "#e5d6b0": "Toile \xE9crue",
            "#cf665d": "Toile corail",
            "#8eaa8c": "Toile sauge",
            "#87a4b5": "Toile bleu gris\xE9",
          };
        P("[data-object-color-preset]").forEach((j, ie) => {
          const ze = tt[ie];
          ((j.hidden = !ze),
            ze &&
              ((j.dataset.objectColorPreset = ze),
              j.style.setProperty("--swatch", ze),
              j.setAttribute("aria-label", l[ze] || "Couleur " + ze),
              (j.title = l[ze] || ze),
              j.setAttribute("aria-pressed", String(ze === ot))));
        });
      }
      const ye = c("[data-object-variant]");
      if (ye)
        for (let ot = 0; ot < ye.options.length; ot++)
          ye.options[ot].textContent =
            ((xt = d == null ? void 0 : d.variants) == null ? void 0 : xt[ot]) ||
            ["Naturelle", "Variante 2", "Variante 3", "Variante 4"][ot];
    }
    function Ft() {
      const i = Ke.get(qe),
        d = i && Ke.catalog.find((ye) => ye.id === i.type);
      if (((c("[data-object-details]").hidden = !i), yt(i, d), i)) {
        ((c("[data-object-name]").textContent = d.label), (c("[data-object-type]").value = i.type));
        for (const ye of ["x", "z", "yOffset", "scale", "variant"]) c("[data-object-" + ye + "]").value = i[ye];
        ((c("[data-object-rotation]").value = +((i.rotation * 180) / Math.PI).toFixed(1)),
          ge.position.set(i.x, x(i.x, i.z) + i.yOffset + 0.13, i.z),
          ge.scale.setScalar(Math.max(0.45, d.radius * i.scale)));
      }
      const Z = T.get(Qe);
      if (
        ((ge.visible = g === "editor" && !!(Z || i)),
        (c("[data-selection-empty]").hidden = !!Z || !!i || !!Ce),
        (c("[data-tree-details]").hidden = !Z),
        !!Z)
      ) {
        (ge.position.set(Z.x, a(Z.x, Z.z) + 0.15, Z.z),
          ge.scale.setScalar(Math.max(0.75, Z.height * Z.spread * 0.33)),
          (c("[data-tree-name]").textContent = Z.label),
          (c("[data-tree-species]").value = Z.species));
        for (const ye of ["height", "diameter", "spread"])
          ((c("[data-tree-" + ye + "]").value = Z[ye]),
            (c("[data-tree-" + ye + "-value]").textContent =
              ye === "spread" ? Math.round(Z[ye] * 100) + " %" : Z[ye].toFixed(ye === "height" ? 1 : 2) + " m"));
        ((c("[data-tree-x]").value = Z.x.toFixed(2)), (c("[data-tree-z]").value = Z.z.toFixed(2)));
      }
    }
    function Bt(i) {
      return (
        (Ce = null),
        (y.visible = !1),
        c("[data-path-selection]") && (c("[data-path-selection]").hidden = !0),
        (qe = null),
        (Qe = T.get(i) ? i : null),
        Ft(),
        n.markDirty(),
        T.get(Qe)
      );
    }
    function Rt() {
      var i, d, Z;
      for (const ye of w) {
        const nt = ye.mesh.geometry.attributes.position,
          xt = ye.base;
        for (let ot = 0; ot < nt.count; ot++) {
          const tt = xt[ot * 3],
            l = xt[ot * 3 + 2];
          nt.array[ot * 3 + 1] = xt[ot * 3 + 1] + X(tt, l) - X(tt, l, N);
        }
        ((nt.needsUpdate = !0),
          ye.mesh.geometry.computeBoundingSphere(),
          (d = (i = ye.mesh).refreshRenderBounds) == null || d.call(i));
      }
      (T.resettle(), Ke.resettle(), (Z = n.landscapeDetails) == null || Z.resettle(), Ft(), xn(), n.invalidate());
    }
    function qt() {
      for (const [i, d, Z, ye] of le.constraints || []) {
        const nt = Ie[d * 3 + 1] * (1 - ye) + Ie[Z * 3 + 1] * ye;
        ((Ie[i * 3 + 1] = nt), (Se.array[i * 3 + 1] = nt));
      }
    }
    function Kt() {
      var i, d;
      for (let Z = 0; Z < Se.count; Z++)
        if (
          n.foundationFootprints.some((ye) => n.footprintDistance(N[Z * 3], N[Z * 3 + 2], ye) < 0.5) ||
          n.protectedSite(N[Z * 3], N[Z * 3 + 2]) ||
          q([N[Z * 3], N[Z * 3 + 2]], 0.65)
        ) {
          const ye = N[Z * 3 + 1];
          Ie[Z * 3 + 1] = Se.array[Z * 3 + 1] = ye;
        }
      (qt(),
        (Se.needsUpdate = !0),
        le.mesh.geometry.computeVertexNormals(),
        le.mesh.geometry.computeBoundingBox(),
        le.mesh.geometry.computeBoundingSphere(),
        (i = le.refreshRenderBounds) == null || i.call(le),
        Rt(),
        (d = n.terrainChanged) == null || d.call(n));
    }
    function ro(i) {
      const d = (i.objects || []).map((xt) => ({ ...xt }));
      if (i.decorationVersion >= 20) return d;
      const Z = new Set(d.map((xt) => xt.id));
      let ye = Math.max(0, ...d.map((xt) => +xt.id.slice(6)));
      const nt = (xt, ot) =>
        ot.points.some((tt, l) => {
          if (!l) return !1;
          const j = ot.points[l - 1],
            ie = tt[0] - j[0],
            ze = tt[1] - j[1],
            Ye = Math.max(0, Math.min(1, ((xt.x - j[0]) * ie + (xt.z - j[1]) * ze) / (ie * ie + ze * ze || 1)));
          return Math.hypot(xt.x - j[0] - Ye * ie, xt.z - j[1] - Ye * ze) < ot.width * 0.5 + 0.7;
        });
      for (const xt of Je.objects) {
        if (d.length >= 2e3) break;
        if (
          (xt.type === "quad" && d.some((tt) => tt.type === "quad")) ||
          i.paths.some((tt) => nt(xt, tt)) ||
          d.some((tt) => Math.hypot(tt.x - xt.x, tt.z - xt.z) < 0.75)
        )
          continue;
        const ot = { ...xt };
        (Z.has(ot.id) && (ot.id = "objet-" + ++ye), Z.add(ot.id), d.push(ot));
      }
      return d;
    }
    function oo(i) {
      var Z, ye, nt, xt, ot;
      (n.catalogue21 && (i = n.catalogue21.migrateDocument(i)),
        Ct(i),
        (Z = n.shore29) == null || Z.cancel(),
        (ye = n.shore29) == null || ye.importContours(i.shorelines29 || []),
        ao.clearProtectionCache(),
        vo(),
        (He = null),
        (Ce = null),
        (y.visible = !1),
        ($e = i.adventure24
          ? {
              holes: i.adventure24.holes.map((tt) => ({
                x: tt.x,
                z: tt.z,
                depth: tt.depth,
                seed: tt.seed,
                ...(tt.changes
                  ? { changes: tt.changes.map((l) => l.slice()), expiresAt: tt.expiresAt, cutId: tt.cutId }
                  : {}),
              })),
              treasure: i.adventure24.treasure,
              opened27: i.adventure24.opened27 === !0,
            }
          : { holes: [], treasure: 0, opened27: !1 }),
        (F = Math.max(
          F,
          ...$e.holes.map((tt) => {
            var l;
            return Number((l = tt.cutId) == null ? void 0 : l.split("-")[1]) || 0;
          }),
        )),
        (xe = [...(i.hiddenPaths || [])]));
      for (const tt of D) (nt = n.setPropertyTrailVisible) == null || nt.call(n, tt.name, !xe.includes(tt.name));
      ((H = (i.ecologyCuts || []).map((tt) => ({ id: tt.id, cells: tt.cells.map((l) => l.slice()) }))),
        (W = Math.max(0, ...H.map((tt) => Number(tt.id.split("-").at(-1)) || 0))),
        Oo(),
        ao.endStroke(),
        Ke.replace(ro(i)),
        (qe = null),
        Io());
      for (let tt = 0; tt < Se.count; tt++) Ie[tt * 3 + 1] = Se.array[tt * 3 + 1] = N[tt * 3 + 1];
      for (const [tt, l] of i.terrain) Ie[tt * 3 + 1] = Se.array[tt * 3 + 1] = N[tt * 3 + 1] + l;
      (ot = (xt = n.player) == null ? void 0 : xt.importParking24) == null || ot.call(xt, i.vehicleParking24 || []);
      const d = !i.styleVersion && i.trees.every((tt) => tt.species === "oak");
      (T.replace(i.trees.map((tt) => ({ ...tt, species: d ? MoulinTreeFamily(tt) : tt.species }))),
        (Ge = i.paths.map((tt) => ({ id: tt.id, width: tt.width, points: tt.points.map((l) => l.slice()) }))),
        (at = Math.max(0, ...Ge.map((tt) => +tt.id.split("-")[1]))),
        (Qe = null),
        (m = []),
        hn(),
        Kt(),
        Mn(),
        So(!1),
        Ft());
    }
    function uo(i) {
      return (
        Ct(i),
        Pt(),
        oo(i),
        We(),
        ne("Les objets, les arbres, le relief et les sentiers ont \xE9t\xE9 restaur\xE9s."),
        !0
      );
    }
    function Tt() {
      (ke && J(!1),
        ce.length &&
          ((pt = null),
          V.push(mt()),
          oo(JSON.parse(ce.pop())),
          we(),
          Dt(),
          ne("Derni\xE8re modification annul\xE9e.")));
    }
    function Jt() {
      (ke && J(!1),
        V.length && ((pt = null), ce.push(mt()), oo(JSON.parse(V.pop())), we(), Dt(), ne("Modification r\xE9tablie.")));
    }
    function io() {
      We();
      const i = new Blob([JSON.stringify(ke || bt(), null, 2)], { type: "application/json" }),
        d = URL.createObjectURL(i),
        Z = document.createElement("a");
      ((Z.href = d),
        (Z.download = "Moulin-mes-retouches.json"),
        Z.click(),
        setTimeout(() => URL.revokeObjectURL(d), 1e3),
        ne("Conservez ce fichier avec la maquette pour retrouver vos retouches sur un autre ordinateur."));
    }
    function po(i) {
      const d = C.getBoundingClientRect();
      (lt.set(((i.clientX - d.left) / d.width) * 2 - 1, 1 - ((i.clientY - d.top) / d.height) * 2),
        he.updateMatrixWorld(),
        je.setFromCamera(lt, he));
      const Z = (l, j) => (G === "object" || G === "scatter" || G === "select" ? x(l, j) : a(l, j)),
        ye = je.ray.origin,
        nt = je.ray.direction,
        xt = new t.Vector3();
      let ot = null,
        tt = 0;
      for (let l = 0.1; l < 1500; l += Math.min(2, 0.4 + l * 0.002)) {
        if ((xt.copy(nt).multiplyScalar(l).add(ye), xt.x < _e.x0 || xt.x > _e.x1 || xt.z < _e.z0 || xt.z > _e.z1)) {
          ot = null;
          continue;
        }
        const j = xt.y - Z(xt.x, xt.z);
        if (j <= 0 && ot !== null && ot > 0) {
          let ie = tt,
            ze = l;
          for (let Ye = 0; Ye < 12; Ye++) {
            const zt = (ie + ze) / 2;
            (xt.copy(nt).multiplyScalar(zt).add(ye), xt.y > Z(xt.x, xt.z) ? (ie = zt) : (ze = zt));
          }
          return (
            xt
              .copy(nt)
              .multiplyScalar((ie + ze) / 2)
              .add(ye),
            (xt.y = Z(xt.x, xt.z)),
            xt
          );
        }
        ((ot = j), (tt = l));
      }
      return null;
    }
    function Yo(i) {
      const d = C.getBoundingClientRect();
      (lt.set(((i.clientX - d.left) / d.width) * 2 - 1, 1 - ((i.clientY - d.top) / d.height) * 2),
        he.updateMatrixWorld(!0),
        je.setFromCamera(lt, he));
    }
    const ao = MoulinTerrainTools21(t, {
        pos: Se,
        base: N,
        values: Ie,
        terrainData: le,
        terrainHeight: X,
        terrainAllowed: fe,
        vertexBuckets: E,
        bounds: _e,
        enforceEdges: qt,
        markDirty: n.markDirty,
      }),
      wo = (i, d) => {
        var ye;
        const Z = parseFloat((ye = c(i)) == null ? void 0 : ye.value);
        return Number.isFinite(Z) ? Z : d;
      };
    function zo(i, d, Z, ye, nt) {
      return {
        x: i,
        z: d,
        mode: Z,
        dt: ye,
        radius: wo("[data-brush-radius]", 4),
        strength: wo("[data-brush-strength]", 0.6),
        targetHeight: nt ?? wo("[data-terrain-altitude]", X(i, d)),
        falloff: wo("[data-brush-falloff]", 45) / 100,
        angle: wo("[data-terrain-angle]", 0),
        delta: wo("[data-terrain-delta]", 2),
        width: wo("[data-terrain-width]", 6),
        length: wo("[data-terrain-length]", 10),
        oneSided: c("[data-terrain-one-sided]").checked,
      };
    }
    function Oo() {
      var d;
      const i = [...H, { id: "repere-coffre27", cells: [[-97.8457, 116.3729, $e.treasure >= 3 ? 1.02 : 0.72]] }];
      n.setTerrainClearedRegions
        ? n.setTerrainClearedRegions(i)
        : (d = n.groundLife) == null || d.setTerrainClearedRegions(i);
    }
    const Q = MoulinTerrainPreview21(t, { parent: M, terrainHeight: X, terrainAllowed: fe, markDirty: n.markDirty });
    function Oe() {
      He = {
        changes: new Map(),
        trees: new Map(T.records.map((i) => [i.id, X(i.x, i.z)])),
        plants: new Map(
          Ke.records
            .filter((i) => {
              var d;
              return (
                ((d = Ke.catalog.find((Z) => Z.id === i.type)) == null ? void 0 : d.category) === "V\xE9g\xE9tation"
              );
            })
            .map((i) => [i.id, X(i.x, i.z)]),
        ),
      };
    }
    function ut(i) {
      He || Oe();
      for (const [d, , Z] of i.changes || []) He.changes.has(d) || He.changes.set(d, Z);
    }
    function At() {
      var zt;
      const i = He;
      if (((He = null), !(i != null && i.changes.size))) return { trees: 0, plants: 0, cells: 0 };
      const d = (ht, Lt) => Lt.has(ht.id) && Math.abs(X(ht.x, ht.z) - Lt.get(ht.id)) > 0.02,
        Z = T.records.filter((ht) => d(ht, i.trees)),
        ye = Ke.records.filter((ht) => d(ht, i.plants)),
        nt = new Set(Z.map((ht) => ht.id)),
        xt = new Set(ye.map((ht) => ht.id));
      (Z.length && T.replace(T.records.filter((ht) => !nt.has(ht.id)).map((ht) => ({ ...ht }))),
        ye.length && Ke.replace(Ke.exportRecords().filter((ht) => !xt.has(ht.id))));
      let ot = 1 / 0,
        tt = -1 / 0,
        l = 1 / 0,
        j = -1 / 0;
      for (const ht of i.changes.keys())
        ((ot = Math.min(ot, N[ht * 3])),
          (tt = Math.max(tt, N[ht * 3])),
          (l = Math.min(l, N[ht * 3 + 2])),
          (j = Math.max(j, N[ht * 3 + 2])));
      ((ot -= 1.6), (tt += 1.6), (l -= 1.6), (j += 1.6));
      const ie = new Proxy(Ie, {
          get(ht, Lt) {
            const Qt = typeof Lt == "string" ? Number(Lt) : NaN;
            return Number.isInteger(Qt) && Qt % 3 === 1 && i.changes.has((Qt - 1) / 3)
              ? i.changes.get((Qt - 1) / 3)
              : Reflect.get(ht, Lt);
          },
        }),
        ze = Math.max(0.5, Math.sqrt(((tt - ot) * (j - l)) / 4096)),
        Ye = [];
      for (let ht = l; ht <= j; ht += ze)
        for (let Lt = ot; Lt <= tt; Lt += ze)
          Lt >= _e.x0 &&
            Lt <= _e.x1 &&
            ht >= _e.z0 &&
            ht <= _e.z1 &&
            fe(Lt, ht) &&
            Math.abs(X(Lt, ht) - X(Lt, ht, ie)) > 0.02 &&
            Ye.push([+Lt.toFixed(3), +ht.toFixed(3), +(ze * 0.7).toFixed(3)]);
      return (
        Ye.length && (H.push({ id: "coupe-" + ++W, cells: Ye }), Oo()),
        nt.has(Qe) && (Qe = null),
        xt.has(qe) && (qe = null),
        Io(),
        Ft(),
        (zt = n.terrainChanged) == null || zt.call(n),
        n.invalidate(),
        { trees: Z.length, plants: ye.length, cells: Ye.length }
      );
    }
    function It() {
      const i = $,
        d = !!i,
        Z = c("[data-terrain-preview-actions]"),
        ye = c("[data-terrain-preview-status]");
      if (
        (Z && (Z.hidden = !d),
        P("[data-terrain-preview-apply]").forEach((xt) => {
          var ot;
          return (xt.disabled = !((ot = i == null ? void 0 : i.plan) != null && ot.count));
        }),
        !i)
      ) {
        ye &&
          (ye.textContent =
            G === "ramp"
              ? "1. Touche le point bas. 2. Touche le c\xF4t\xE9 qui doit monter."
              : "Touche le terrain pour placer un plateau \xE0 pr\xE9visualiser.");
        return;
      }
      const nt =
        i.phase === "direction"
          ? "Choisis maintenant la direction et la longueur dans la sc\xE8ne. "
          : i.phase === "move"
            ? "Touche le nouvel emplacement. "
            : "";
      ye &&
        (ye.textContent =
          nt +
          (i.plan.count
            ? `${i.stats.fill.toFixed(1)} m\xB3 ajout\xE9s \xB7 ${i.stats.cut.toFixed(1)} m\xB3 retir\xE9s. ${i.removeCount} ${i.removeCount > 1 ? "v\xE9g\xE9taux retir\xE9s" : "v\xE9g\xE9tal retir\xE9"} si tu appliques.`
            : "Aucune modification possible ici : zone prot\xE9g\xE9e ou maillage trop espac\xE9."));
    }
    function Vt(i) {
      const d = {
        width: "width",
        length: "length",
        angle: "angle",
        delta: "delta",
        targetHeight: "altitude",
        falloff: "falloff",
      };
      for (const [Z, ye] of Object.entries(d))
        if (Number.isFinite(i[Z])) {
          const nt = c("[data-" + (Z === "falloff" ? "brush-falloff" : "terrain-" + ye) + "]");
          nt && (nt.value = Z === "falloff" ? Math.round(i[Z] * 100) : +i[Z].toFixed(2));
        }
      i.oneSided !== void 0 && c("[data-terrain-one-sided]") && (c("[data-terrain-one-sided]").checked = i.oneSided);
    }
    function Ut(i = {}) {
      if (!$) return null;
      Object.assign($.options, i);
      const d = $,
        Z = d.options;
      return (
        ao.beginStroke(Z),
        (d.plan = ao.plan({ ...Z, dt: 1, strength: 12 })),
        ao.endStroke(),
        (d.stats = Q.update(d.plan)),
        (d.removeCount =
          T.records.reduce((ye, nt) => ye + (Math.abs(d.plan.heightAt(nt.x, nt.z) - X(nt.x, nt.z)) > 0.02 ? 1 : 0), 0) +
          Ke.records.reduce((ye, nt) => {
            var xt;
            return (
              ye +
              (((xt = Ke.catalog.find((ot) => ot.id === nt.type)) == null ? void 0 : xt.category) ===
                "V\xE9g\xE9tation" && Math.abs(d.plan.heightAt(nt.x, nt.z) - X(nt.x, nt.z)) > 0.02
                ? 1
                : 0)
            );
          }, 0)),
        Vt(Z),
        It(),
        n.markDirty(),
        d.plan
      );
    }
    function eo(i, d, Z = "ramp", ye = {}) {
      return (
        So(!0),
        !["ramp", "terrace"].includes(Z) || !fe(i, d)
          ? (ne("Choisis un point sur le terrain libre pour placer l\u2019aper\xE7u.", !0), null)
          : (Le && Cn(),
            ($ = {
              options: { ...zo(i, d, Z, 1), targetHeight: X(i, d), ...ye, x: i, z: d, mode: Z },
              phase: ye.phase || "ready",
              plan: null,
              stats: null,
              removeCount: 0,
            }),
            (U = null),
            (ae.visible = !1),
            (de.visible = !1),
            Ut())
      );
    }
    function mo(i = {}) {
      return Ut(i);
    }
    function vo() {
      (($ = null), (U = null), ao.endStroke(), Q.hide(), It());
    }
    function fo() {
      var ye;
      if (!((ye = $ == null ? void 0 : $.plan) != null && ye.count)) return !1;
      const i = $.plan;
      (Pt(), Oe());
      let d;
      try {
        d = ao.applyPlan(i);
      } catch (nt) {
        return ((He = null), (pt = null), ne(nt.message, !0), !1);
      }
      (ut(d), Kt());
      const Z = At();
      return (
        vo(),
        We(),
        ne(
          "Relief appliqu\xE9. " +
            (Z.trees + Z.plants) +
            " v\xE9g\xE9taux retir\xE9s de la zone modifi\xE9e. Tu peux annuler.",
        ),
        !0
      );
    }
    function Do(i, d = !1) {
      if (!$) return;
      const Z = $.options,
        ye = i.x - Z.x,
        nt = i.z - Z.z;
      Math.hypot(ye, nt) < 0.5 ||
        (d && ($.phase = "ready"),
        Ut({ angle: ((Math.atan2(nt, ye) * 180) / Math.PI + 360) % 360, length: Ne(Math.hypot(ye, nt) * 2, 1, 60) }));
    }
    function ho(i) {
      if (!$) {
        eo(i.x, i.z, G, { phase: G === "ramp" ? "direction" : "ready" });
        return;
      }
      if ($.phase === "direction") {
        Do(i, !0);
        return;
      }
      if ($.phase === "move") {
        const d = $.options;
        eo(i.x, i.z, d.mode, { ...d, x: i.x, z: i.z, targetHeight: X(i.x, i.z), phase: "ready" });
        return;
      }
      ne("D\xE9place les poign\xE9es, ajuste les r\xE9glages, puis clique sur \xAB Appliquer le relief \xBB.");
    }
    function Xo() {
      if (!$) return;
      const i = $.options;
      Ut(zo(i.x, i.z, i.mode, 1));
    }
    function Ko() {
      return [
        ...Ge.map((i, d) => ({ ...i, label: "Mon sentier " + (d + 1), native: !1 })),
        ...D.filter((i) => !xe.includes(i.name)).map((i) => ({
          ...i,
          id: "native:" + i.name,
          label: i.label || i.name.replaceAll("_", " "),
          native: !0,
        })),
      ];
    }
    function ln(i, d) {
      let Z = 1 / 0;
      for (let ye = 1; ye < d.points.length; ye++) {
        const nt = d.points[ye - 1],
          xt = d.points[ye],
          ot = xt[0] - nt[0],
          tt = xt[1] - nt[1],
          l = Ne(((i.x - nt[0]) * ot + (i.z - nt[1]) * tt) / (ot * ot + tt * tt || 1), 0, 1);
        Z = Math.min(Z, Math.hypot(i.x - nt[0] - l * ot, i.z - nt[1] - l * tt));
      }
      return Z;
    }
    function jo(i) {
      var d;
      return (
        (i &&
          ((d = Ko()
            .map((Z) => ({ p: Z, d: ln(i, Z) }))
            .filter((Z) => Z.d < Z.p.width * 0.5 + 0.35)
            .sort((Z, ye) => Z.d - ye.d)[0]) == null
            ? void 0
            : d.p)) ||
        null
      );
    }
    function an(i, d = !1) {
      var nt;
      ((Ce = ((nt = Ko().find((xt) => xt.id === i)) == null ? void 0 : nt.id) || null), (Qe = null), (qe = null), Ft());
      const Z = Ko().find((xt) => xt.id === Ce);
      if (((y.visible = !!Z), Z)) {
        if (
          (y.geometry.dispose(),
          (y.geometry = new t.BufferGeometry().setFromPoints(
            Z.points.map((xt) => new t.Vector3(xt[0], a(...xt) + 0.16, xt[1])),
          )),
          d)
        ) {
          const xt = Z.points[Math.floor(Z.points.length / 2)],
            ot = a(...xt);
          (te.target.set(xt[0], ot, xt[1]), he.position.set(xt[0] + 9, ot + 12, xt[1] + 15), he.lookAt(te.target));
        }
        ne(Z.label + " s\xE9lectionn\xE9. Supprimer retire uniquement ce sentier.");
      }
      const ye = c("[data-path-selection]");
      return (
        ye && (ye.hidden = !Z),
        c("[data-path-selected-name]") &&
          (c("[data-path-selected-name]").textContent = (Z == null ? void 0 : Z.label) || ""),
        n.markDirty(),
        Z
      );
    }
    function Eo(i) {
      var Z;
      const d = Ko().find((ye) => ye.id === i);
      return d
        ? (Pt(),
          d.native
            ? (xe.push(d.name), (Z = n.setPropertyTrailVisible) == null || Z.call(n, d.name, !1))
            : (Ge = Ge.filter((ye) => ye.id !== i)),
          Ce === i && an(null),
          xn(),
          We(),
          n.invalidate(),
          ne("Sentier retir\xE9. Tu peux annuler ou le restaurer dans la liste."),
          !0)
        : !1;
    }
    function tn(i) {
      var d;
      return xe.includes(i)
        ? (Pt(),
          (xe = xe.filter((Z) => Z !== i)),
          (d = n.setPropertyTrailVisible) == null || d.call(n, i, !0),
          xn(),
          We(),
          n.invalidate(),
          !0)
        : !1;
    }
    function To() {
      var Z;
      const i = c("[data-path-list]");
      i.replaceChildren();
      for (const ye of Ko()) {
        const nt = document.createElement("div");
        nt.className = "path-row";
        const xt = document.createElement("button");
        ((xt.type = "button"),
          (xt.className = "btn path-name"),
          (xt.textContent = ye.label),
          (xt.title = "S\xE9lectionner et voir ce sentier"),
          xt.addEventListener("click", () => {
            (zn("path-select"), an(ye.id, !0));
          }));
        const ot = document.createElement("button");
        ((ot.type = "button"),
          (ot.className = "btn"),
          (ot.textContent = "Supprimer"),
          ot.addEventListener("click", () => Eo(ye.id)),
          nt.append(xt, ot),
          i.append(nt));
      }
      const d = c("[data-path-restore-list]");
      if (d) {
        d.replaceChildren();
        for (const ye of xe) {
          const nt = document.createElement("button");
          ((nt.type = "button"),
            (nt.className = "btn wide"),
            (nt.textContent = "Restaurer " + ye.replaceAll("_", " ")),
            nt.addEventListener("click", () => tn(ye)),
            d.append(nt));
        }
      }
      (Z = c("[data-path-empty]")) == null || Z.toggleAttribute("hidden", Ko().length > 0);
    }
    function _o(i, d, Z = G, ye = 0.1, nt) {
      var ot;
      So(!0);
      const xt = ao.apply(zo(i, d, Z, ye, nt));
      return (
        ut(xt),
        Le && (Le.changed = (Le.changed || 0) + xt.count),
        xt.changed &&
          ((ot = le.refreshRenderBounds) == null || ot.call(le),
          performance.now() - De > 200 && (le.mesh.geometry.computeVertexNormals(), (De = performance.now())),
          n.markDirty()),
        xt.count
      );
    }
    function fn(i, d, Z = "raise", ye = 1, nt = {}) {
      (So(!0), vo(), Pt(), Oe(), ao.beginStroke({ x: i, z: d, mode: Z, targetHeight: nt.targetHeight ?? X(i, d) }));
      const xt = ao.apply({ ...zo(i, d, Z, ye), ...nt });
      return (ut(xt), ao.endStroke(), Kt(), At(), We(), xt.count);
    }
    function Vo(i, d) {
      return [[+i.toFixed(3), +d.toFixed(3), 1.3]];
    }
    function Mn() {
      var i;
      for (const d of $e.holes) {
        if (d.changes) continue;
        ao.beginStroke({ x: d.x, z: d.z, mode: "lower" });
        const Z = ao.plan({ x: d.x, z: d.z, mode: "lower", dt: 1, radius: 1.22, strength: 1, falloff: 0.78 });
        ao.endStroke();
        const ye = X(d.x, d.z) - ((i = Z.heightAt) == null ? void 0 : i.call(Z, d.x, d.z)),
          nt = ye > 1e-6 ? Math.min(1.1, d.depth / ye) : 0;
        ((d.changes = (Z.changes || []).map(([xt, ot, tt]) => [xt, tt + (tt - ot) * nt, tt])),
          (d.expiresAt = B + 2e4),
          (d.cutId = "fouille25-" + ++F),
          H.push({ id: d.cutId, cells: Vo(d.x, d.z) }));
      }
      Oo();
    }
    function So(i = !1) {
      B = Math.max(B, Date.now());
      const d = $e.holes.filter((ye) => i || ye.expiresAt <= B);
      if (!d.length) return !1;
      for (const ye of d.slice().reverse())
        for (const [nt, xt, ot] of ye.changes || []) {
          const tt = Ie[nt * 3 + 1],
            l = Math.abs(tt - ot) < 1e-7 ? xt : tt + xt - ot;
          Ie[nt * 3 + 1] = Se.array[nt * 3 + 1] = Ne(l, N[nt * 3 + 1] - 12, N[nt * 3 + 1] + 12);
        }
      const Z = new Set(d.map((ye) => ye.cutId));
      return (
        (H = H.filter((ye) => !Z.has(ye.id))),
        ($e.holes = $e.holes.filter((ye) => !d.includes(ye))),
        Oo(),
        Kt(),
        Dt(),
        n.markDirty(),
        !0
      );
    }
    function ia(i = 0) {
      return ((B = Math.max(Date.now(), B + Math.max(0, Number.isFinite(i) ? i : 0) * 1e3)), pt === null && So(!1));
    }
    function on(i, d, Z = !1) {
      if ((So(!1), !Number.isFinite(i) || !Number.isFinite(d) || !fe(i, d)))
        return { changed: !1, reason: "protected" };
      let ye = $e.holes.find((tt) => Math.hypot(tt.x - i, tt.z - d) < 0.9);
      if (!ye && $e.holes.length >= 96) return { changed: !1, reason: "limit" };
      if (ye && ye.depth >= 0.82) return { changed: !1, reason: "deep" };
      ye && ((i = ye.x), (d = ye.z));
      const nt = Math.min(0.27, 0.84 - ((ye == null ? void 0 : ye.depth) || 0)),
        xt = X(i, d);
      (vo(), Pt(), ao.beginStroke({ x: i, z: d, mode: "lower" }));
      const ot = ao.apply({ x: i, z: d, mode: "lower", dt: 1, radius: 1.22, strength: nt, falloff: 0.78 });
      if ((ao.endStroke(), ot.changed)) {
        ye ||
          ((ye = {
            x: +i.toFixed(4),
            z: +d.toFixed(4),
            depth: 0,
            seed: ++F % 1e4,
            changes: [],
            cutId: "fouille25-" + F,
            expiresAt: 0,
          }),
          $e.holes.push(ye),
          H.push({ id: ye.cutId, cells: Vo(i, d) }));
        const tt = new Map(ye.changes.map((l) => [l[0], l]));
        for (const [l, j, ie] of ot.changes) {
          const ze = tt.get(l);
          ze ? (ze[2] += j - ie) : tt.set(l, [l, ie, j]);
        }
        ((ye.changes = [...tt.values()]),
          (ye.expiresAt = B + 2e4),
          (ye.depth = +Math.min(0.84, ye.depth + Math.max(0, xt - X(i, d))).toFixed(4)),
          Oo(),
          Kt(),
          Z &&
            Math.hypot(i + 97.8457, d - 116.3729) < 1.25 &&
            (($e.treasure = Math.min(3, $e.treasure + 1)), $e.treasure === 3 && Oo()));
      }
      return (
        We(),
        { changed: !!ot.changed, count: ot.count, depth: (ye == null ? void 0 : ye.depth) || 0, treasure: $e.treasure }
      );
    }
    function Ro() {
      return $e.treasure < 3 ? !1 : ($e.opened27 || (Pt(), ($e.opened27 = !0), We(), n.markDirty()), !0);
    }
    function cn(i, d) {
      return K(i, d) && !n.foundationFootprints.some((Z) => n.footprintDistance(i, d, Z) < 0.08);
    }
    function Io() {
      c("[data-object-count]").textContent = Ke.records.length + " objet" + (Ke.records.length === 1 ? "" : "s");
      const i = c("[data-object-list]");
      i.replaceChildren(new Option("Retrouver un objet\u2026", ""));
      for (const d of Ke.records)
        i.add(new Option(Ke.catalog.find((Z) => Z.id === d.type).label + " \xB7 " + d.id, d.id));
      i.value = qe || "";
    }
    function Dn(i) {
      return (
        (Ce = null),
        (y.visible = !1),
        c("[data-path-selection]") && (c("[data-path-selection]").hidden = !0),
        (Qe = null),
        (qe = Ke.get(i) ? i : null),
        Ft(),
        (c("[data-object-list]").value = qe || ""),
        n.markDirty(),
        Ke.get(i)
      );
    }
    function wn(i, d, Z = {}, ye = !0) {
      if (!cn(i, d))
        return (ne("Placez l\u2019objet sur la terre ferme ou la terrasse, hors des b\xE2timents.", !0), null);
      if (Ke.records.length >= 2e3)
        return (ne("Limite de 2 000 objets atteinte. Supprimez quelques \xE9l\xE9ments.", !0), null);
      ye && Pt();
      const nt = Ke.add({
        type: Xe,
        x: i,
        z: d,
        yOffset: 0,
        rotation: (wo("[data-placement-rotation]", 0) * Math.PI) / 180,
        scale: wo("[data-placement-scale]", 1),
        variant: Math.floor(Math.random() * 4),
        ...Z,
      });
      return (
        ye &&
          (Dn(nt.id),
          Io(),
          We(),
          n.invalidate(),
          ne("Objet plac\xE9. S\xE9lectionnez-le pour le d\xE9placer, le tourner ou le dupliquer.")),
        nt
      );
    }
    function No(i) {
      var Z, ye;
      Pt();
      const d = (ye = (Z = n.player) == null ? void 0 : Z.setParkedCar24) == null ? void 0 : ye.call(Z, i);
      return (We(), n.invalidate(), d);
    }
    function rn(i, d) {
      const Z = Ke.get(i);
      if (!Z) return null;
      const ye = { ...Z, ...d };
      if (!cn(ye.x, ye.z)) return (ne("Cette position est dans l\u2019eau ou dans un b\xE2timent.", !0), Ft(), null);
      const nt = bt();
      nt.objects = nt.objects.map((xt) => (xt.id === i ? ye : xt));
      try {
        Ct(nt);
      } catch (xt) {
        return (ne(xt.message, !0), Ft(), null);
      }
      return (Pt(), Ke.update(i, d), Io(), Ft(), We(), n.invalidate(), Ke.get(i));
    }
    function Bn(i) {
      Ke.get(i) &&
        (Pt(),
        Ke.remove(i),
        qe === i && (qe = null),
        Io(),
        Ft(),
        We(),
        n.invalidate(),
        ne("Objet supprim\xE9. Vous pouvez annuler."));
    }
    function mn() {
      const i = Ke.get(qe);
      if (!i) return;
      const d = Ke.catalog.find((ye) => ye.id === i.type),
        Z = Math.max(0.6, d.radius * i.scale * 1.6);
      for (const [ye, nt] of [
        [Z, 0],
        [-Z, 0],
        [0, Z],
        [0, -Z],
      ])
        if (cn(i.x + ye, i.z + nt)) {
          const { id: xt, x: ot, z: tt, ...l } = i;
          return wn(ot + ye, tt + nt, l);
        }
      ne("Pas de place libre \xE0 proximit\xE9.", !0);
    }
    function Hn(i) {
      var d, Z;
      (ve && (M.remove(ve), (Z = (d = ve.userData).dispose) == null || Z.call(d), (ve = null)),
        Ke.catalog.some((ye) => ye.id === i) &&
          ((Xe = i),
          ["bambou", "foret-bambous", "carex"].includes(i) &&
            (c("[data-scatter-spacing]").value = i === "foret-bambous" ? "6" : i === "bambou" ? "2.5" : "1.1"),
          (c("[data-catalog-current]").textContent = Ke.catalog.find((ye) => ye.id === i).label),
          zn("object"),
          sn()));
    }
    function sn() {
      const i = (c("[data-catalog-search]").value || "").toLocaleLowerCase("fr"),
        d = c("[data-catalog-category]").value,
        Z = c("[data-catalog-grid]");
      Z.replaceChildren();
      for (const ye of Ke.catalog) {
        if (
          (d && d !== "all" && ye.category !== d && ye.family !== d) ||
          (i && !(ye.label + " " + ye.description + " " + (ye.keywords || "")).toLocaleLowerCase("fr").includes(i))
        )
          continue;
        const nt = document.createElement("button");
        ((nt.type = "button"),
          (nt.className = "catalog-card"),
          (nt.dataset.catalogId = ye.id),
          nt.setAttribute("aria-pressed", String(Xe === ye.id)));
        const xt = document.createElement("span");
        ((xt.className = "catalog-icon"), (xt.innerHTML = ye.icon));
        const ot = document.createElement("span");
        ot.textContent = ye.label;
        const tt = document.createElement("small");
        ((tt.textContent = ye.family || ye.category),
          (nt.title = ye.description),
          nt.append(xt, ot, tt),
          nt.addEventListener("click", () => Hn(ye.id)),
          Z.append(nt));
      }
    }
    function Qo(i) {
      if (Ke.catalog.find((ye) => ye.id === Xe).category !== "V\xE9g\xE9tation") {
        ne("Pour peindre, choisissez une foug\xE8re, un massif ou un bosquet.", !0);
        return;
      }
      const Z = Ne(wo("[data-scatter-spacing]", 1.5), 0.6, 8);
      (_t != null && _t.last && i.distanceTo(_t.last) < Z) ||
        (_t && (_t.last = i.clone()),
        wn(
          i.x,
          i.z,
          {
            rotation: Math.random() * Math.PI * 2,
            scale: Ne(wo("[data-placement-scale]", 1) * (0.82 + Math.random() * 0.36), 0.1, 5),
          },
          !1,
        ),
        (c("[data-object-count]").textContent = Ke.records.length + " objets"),
        n.invalidate());
    }
    function un() {
      if (Ce) {
        Eo(Ce);
        return;
      }
      if (qe) {
        Bn(qe);
        return;
      }
      Qe &&
        (Pt(), T.remove(Qe), (Qe = null), Ft(), We(), n.invalidate(), ne("Arbre supprim\xE9. Vous pouvez annuler."));
    }
    function Go(i, d, Z = {}) {
      if (!K(i, d)) return (ne("Choisissez un emplacement sur la terre ferme.", !0), null);
      Pt();
      const ye = Z.species || c("[data-add-species]").value,
        nt = T.add({
          x: i,
          z: d,
          species: ye,
          height: ye === "oak" ? 16 : ye === "birch" ? 18 : 20,
          diameter: ye === "oak" ? 0.72 : ye === "birch" ? 0.3 : 0.54,
          spread: 1,
          ...Z,
        });
      return (
        T.rebuild(),
        Bt(nt.id),
        We(),
        n.invalidate(),
        ne("Arbre ajout\xE9. S\xE9lectionnez-le pour le d\xE9placer ou le redimensionner."),
        nt
      );
    }
    function kn(i, d) {
      T.get(i) && (Pt(), T.update(i, d), Ft(), We(), n.invalidate());
    }
    function xn() {
      for (const i of [...I.children])
        (i.traverse((d) => {
          d.geometry && d.geometry.dispose();
        }),
          I.remove(i));
      for (const i of Ge) {
        const d = new t.CatmullRomCurve3(
            i.points.map((j) => new t.Vector3(j[0], 0, j[1])),
            !1,
            "centripetal",
          ),
          Z = d.getLength(),
          ye = Math.max(2, Math.ceil(Z / 0.35)),
          nt = [],
          xt = [],
          ot = [];
        for (let j = 0; j <= ye; j++) {
          const ie = j / ye,
            ze = d.getPointAt(ie),
            Ye = d.getTangentAt(ie),
            zt = 1 + 0.035 * Math.sin(j * 2.32);
          for (const ht of [-1, 1]) {
            const Lt = ze.x - Ye.z * i.width * 0.5 * ht * zt,
              Qt = ze.z + Ye.x * i.width * 0.5 * ht * zt;
            (nt.push(Lt, a(Lt, Qt) + 0.047, Qt), xt.push(Lt * 0.85, Qt * 0.85));
          }
          if (j < ye) {
            const ht = j * 2;
            ot.push(ht, ht + 2, ht + 3, ht, ht + 3, ht + 1);
          }
        }
        const tt = new t.BufferGeometry();
        (tt.setAttribute("position", new t.Float32BufferAttribute(nt, 3)),
          tt.setAttribute("uv", new t.Float32BufferAttribute(xt, 2)),
          tt.setIndex(ot),
          tt.computeVertexNormals());
        const l = new t.Mesh(tt, Be);
        ((l.name = "Sentier_de_feuilles_" + i.id), (l.receiveShadow = !0), I.add(l));
      }
      (To(), Ce && an(Ce));
    }
    function hn() {
      (oe.geometry.dispose(),
        (oe.geometry = new t.BufferGeometry().setFromPoints(m.map((i) => new t.Vector3(i[0], a(...i) + 0.12, i[1])))),
        (c("[data-path-finish]").disabled = m.length < 2),
        (c("[data-path-cancel]").disabled = !m.length),
        (c("[data-path-count]").textContent = m.length + " point" + (m.length === 1 ? "" : "s")),
        n.markDirty());
    }
    function Gn(i, d) {
      const Z = new t.CatmullRomCurve3(
          i.map((nt) => new t.Vector3(nt[0], 0, nt[1])),
          !1,
          "centripetal",
        ),
        ye = Math.ceil(Z.getLength() / 0.5);
      for (let nt = 0; nt <= ye; nt++) {
        const xt = Z.getPointAt(nt / Math.max(1, ye)),
          ot = Z.getTangentAt(nt / Math.max(1, ye));
        for (const tt of [-0.5, 0, 0.5]) if (!fe(xt.x - ot.z * d * tt, xt.z + ot.x * d * tt)) return !1;
      }
      return !0;
    }
    function dn(i, d = +c("[data-path-width]").value) {
      if (i.length < 2) return null;
      if (!Gn(i, d))
        return (
          ne(
            "Le sentier traverse de l\u2019eau ou de la ma\xE7onnerie. Rapprochez ses points pour suivre le terrain libre.",
            !0,
          ),
          null
        );
      Pt();
      const Z = { id: "sentier-" + ++at, width: d, points: i.map((ye) => ye.slice()) };
      return (Ge.push(Z), xn(), We(), n.invalidate(), Z);
    }
    function _n() {
      dn(m) && ((m = []), hn(), ne("Sentier de feuilles ajout\xE9."));
    }
    function zn(i) {
      var d;
      (Cn(),
        (d = n.shore29) == null || d.setActive(g === "editor" && i === "shore"),
        G !== i && vo(),
        We(),
        (G = i),
        It(),
        G === "scatter" &&
          Ke.catalog.find((Z) => Z.id === Xe).category !== "V\xE9g\xE9tation" &&
          ((Xe = "massif-fougeres"), (c("[data-catalog-current]").textContent = "Massif de foug\xE8res"), sn()),
        ve && (ve.visible = !1),
        (ae.visible = !1),
        P("[data-tool]").forEach((Z) => Z.setAttribute("aria-pressed", String(Z.dataset.tool === G))),
        P("[data-tool-panel]").forEach((Z) => (Z.hidden = !Z.dataset.toolPanel.split(" ").includes(G))),
        (de.visible = !1),
        n.markDirty());
    }
    function An() {
      (Me.clear(), me.set(0, 0, 0), (Ve = !1));
    }
    function Xn() {
      var i;
      ((i = n.shore29) == null || i.setActive(g === "editor" && G === "shore"),
        (A.dataset.mode = g),
        P("[data-mode]").forEach((d) => d.setAttribute("aria-pressed", String(d.dataset.mode === g))),
        (c("[data-editor-panel]").hidden = g !== "editor"),
        (c("[data-flight-bar]").hidden = g !== "fly"),
        (c("[data-fly-hint]").hidden = g !== "fly"),
        (M.visible = g === "editor"),
        Ft(),
        n.invalidate());
    }
    function Fn(i) {
      var d, Z, ye, nt, xt;
      if ((i === "editor" && ke && J(!1), !(!["orbit", "fly", "editor", "play", "globe"].includes(i) || g === i))) {
        if (
          ((d = n.beforeModeChange) == null || d.call(n, i, g),
          Cn(),
          vo(),
          ao.endStroke(),
          (Z = n.player) == null || Z.setEnabled(!1),
          (Fe = null),
          (_t = null),
          We(),
          i === "editor" && So(!0),
          An(),
          (ye = n.cancelTransition) == null || ye.call(n),
          document.pointerLockElement === C && document.exitPointerLock(),
          g === "fly")
        ) {
          he.getWorldDirection(new t.Vector3());
          const ot = he.getWorldDirection(new t.Vector3());
          te.target.copy(he.position).addScaledVector(ot, 12);
        }
        if (i === "fly") {
          (!Re && g !== "editor" && S("promenade", !0), (Re = !0), (te.enabled = !1), (te.enableDamping = !1));
          const ot = new t.Euler().setFromQuaternion(he.quaternion, "YXZ");
          ((ue = ot.y), (se = ot.x), (he.fov = 65), he.updateProjectionMatrix(), C.focus({ preventScroll: !0 }));
        } else ((te.enabled = i !== "play"), (te.enableDamping = i !== "play"), i !== "play" && te.update());
        if (((g = i), g === "play" && ((nt = n.player) == null || nt.setEnabled(!0)), g === "editor")) {
          const ot = R.getObjectByName("Boisements");
          (ot && (ot.visible = !0),
            c("[data-trees]").setAttribute("aria-pressed", "true"),
            ne(
              "Cliquez sur un arbre pour le s\xE9lectionner. Glissez-le pour le d\xE9placer. Clic droit : d\xE9placer la vue.",
            ));
        }
        (Xn(), (xt = n.onModeChange) == null || xt.call(n, g));
      }
    }
    function nn() {
      ((g === "fly" || g === "play" || g === "globe") && Fn("orbit"), An());
    }
    function gn(i) {
      if (g !== "fly") return;
      i = Math.min(i, 0.05);
      const d = (ie, ze) => (Me.has(ie) ? 1 : 0) - (Me.has(ze) ? 1 : 0),
        Z = he.getWorldDirection(new t.Vector3()),
        ye = new t.Vector3().crossVectors(Z, new t.Vector3(0, 1, 0)).normalize(),
        nt = new t.Vector3()
          .addScaledVector(Z, (Me.has("z") || Me.has("w") ? 1 : 0) - (Me.has("s") ? 1 : 0))
          .addScaledVector(ye, (Me.has("d") ? 1 : 0) - (Me.has("q") || Me.has("a") ? 1 : 0));
      ((nt.y += (Me.has(" ") ? 1 : 0) - (Me.has("control") || Me.has("c") ? 1 : 0)),
        nt.lengthSq() > 0 && nt.normalize());
      const xt = +c("[data-flight-speed]").value * (Me.has("shift") ? 2.5 : 1);
      if ((me.lerp(nt.multiplyScalar(xt), 1 - Math.exp(-12 * i)), me.lengthSq() < 1e-5)) return;
      const ot = he.position.clone(),
        tt = ot.clone().addScaledVector(me, i),
        l = ot.distanceTo(tt),
        j = Math.max(1, Math.ceil(l / 0.3));
      if (
        ((tt.x = Ne(tt.x, _e.x0 - 10, _e.x1 + 10)),
        (tt.z = Ne(tt.z, _e.z0 - 10, _e.z1 + 10)),
        (tt.y = Ne(tt.y, -4, 400)),
        c("[data-flight-collision]").checked)
      ) {
        let ie = -1 / 0;
        for (let ze = 1; ze <= j; ze++) {
          const Ye = ze / j;
          ie = Math.max(ie, x(ot.x + (tt.x - ot.x) * Ye, ot.z + (tt.z - ot.z) * Ye) + 0.85);
        }
        tt.y = Math.max(tt.y, ie);
      }
      (he.position.copy(tt), te.target.copy(he.position).addScaledVector(Z, 12), n.markDirty());
    }
    function ea(i, d) {
      ((ue -= i * 0.0022),
        (se = Ne(se - d * 0.0022, -Math.PI * 0.493, Math.PI * 0.493)),
        he.quaternion.setFromEuler(new t.Euler(se, ue, 0, "YXZ")),
        te.target.copy(he.position).addScaledVector(he.getWorldDirection(new t.Vector3()), 12),
        n.markDirty());
    }
    async function Sn() {
      try {
        C.requestPointerLock
          ? await C.requestPointerLock()
          : ne("Maintenez le clic droit dans la vue pour regarder autour de vous.");
      } catch {
        c("[data-fly-hint]").textContent = "Souris : maintenez le clic droit \xB7 ZQSD pour avancer";
      }
    }
    function Jo(i) {
      g === "editor" && Le && _o(Le.point.x, Le.point.z, G, Math.min(i, 0.08), Le.target);
    }
    ((C.tabIndex = 0),
      C.addEventListener("contextmenu", (i) => {
        g === "fly" && i.preventDefault();
      }),
      C.addEventListener(
        "pointerdown",
        (i) => {
          if (g === "fly") {
            if ((i.preventDefault(), i.stopImmediatePropagation(), C.focus(), i.pointerType === "touch")) {
              ((Ve = !0), (vt = { x: i.clientX, y: i.clientY }), C.setPointerCapture(i.pointerId));
              return;
            }
            (i.button === 0 && Sn(),
              i.button === 2 && ((Ve = !0), (vt = { x: i.clientX, y: i.clientY }), C.setPointerCapture(i.pointerId)));
            return;
          }
          if (g !== "editor" || i.button !== 0 || i.altKey || c("[data-editor-navigate]").checked) return;
          if (G === "shore") {
            (i.preventDefault(),
              i.stopImmediatePropagation(),
              Yo(i),
              n.shore29.pointerDown(je, Number(c("[data-shore-radius]").value)) &&
                ((te.enabled = !1), C.setPointerCapture(i.pointerId)));
            return;
          }
          const d = po(i);
          if (Mt && d) {
            (i.preventDefault(),
              i.stopImmediatePropagation(),
              (c("[data-terrain-altitude]").value = X(d.x, d.z).toFixed(2)),
              (Mt = !1),
              Xo(),
              c("[data-terrain-sample-altitude]").setAttribute("aria-pressed", "false"),
              ne("Altitude relev\xE9e : " + c("[data-terrain-altitude]").value + " m."));
            return;
          }
          if (G === "select") {
            Yo(i);
            const ye = T.pick(je),
              nt = Ke.pick(je),
              xt = nt && (!ye || nt.distance < ye.distance) ? nt : ye;
            if (!xt) {
              const l = jo(d);
              l ? (i.preventDefault(), i.stopImmediatePropagation(), an(l.id)) : Bt(null);
              return;
            }
            (i.preventDefault(), i.stopImmediatePropagation());
            const ot = !!Ke.get(xt.id),
              tt = ot ? Dn(xt.id) : Bt(xt.id);
            (Pt(),
              (te.enabled = !1),
              (Fe = { id: xt.id, isObject: ot, offset: d ? [tt.x - d.x, tt.z - d.z] : [0, 0] }),
              C.setPointerCapture(i.pointerId));
            return;
          }
          if (["ramp", "terrace"].includes(G)) {
            (i.preventDefault(), i.stopImmediatePropagation(), Yo(i));
            const ye = Q.pick(je);
            if (ye && $) {
              const nt = Q.handles.find((xt) => xt.userData.terrainHandle21 === ye);
              ((U = { kind: ye, y: (nt == null ? void 0 : nt.position.y) ?? (d == null ? void 0 : d.y) ?? 0 }),
                ($.phase = "ready"),
                (te.enabled = !1),
                C.setPointerCapture(i.pointerId));
              return;
            }
            d && ho(d);
            return;
          }
          if (G === "path-select") {
            (i.preventDefault(), i.stopImmediatePropagation());
            const ye = jo(d);
            (an(ye == null ? void 0 : ye.id), ye || ne("Touche un sentier ou choisis-le dans la liste."));
            return;
          }
          if ((i.preventDefault(), i.stopImmediatePropagation(), !d)) return;
          if (((te.enabled = !1), C.setPointerCapture(i.pointerId), G === "object")) {
            wn(d.x, d.z);
            return;
          }
          if (G === "scatter") {
            (Pt(), (_t = { last: null }), Qo(d));
            return;
          }
          if (G === "add") {
            Go(d.x, d.z);
            return;
          }
          if (G === "path") {
            if (!fe(d.x, d.z)) {
              ne("Placez les points du sentier sur le terrain libre.", !0);
              return;
            }
            if (m.length >= 250) return;
            ((!m.length || Math.hypot(d.x - m.at(-1)[0], d.z - m.at(-1)[1]) > 0.15) && m.push([d.x, d.z]), hn());
            return;
          }
          if (!st.includes(G)) return;
          (Pt(), Oe());
          const Z = wo("[data-terrain-altitude]", X(d.x, d.z));
          (ao.beginStroke({ x: d.x, z: d.z, mode: G, targetHeight: Z }),
            (Le = { point: d, target: Z }),
            _o(d.x, d.z, G, 0.12, Z));
        },
        !0,
      ),
      C.addEventListener("pointermove", (i) => {
        if (g === "fly" && Ve && document.pointerLockElement !== C) {
          (ea(i.clientX - vt.x, i.clientY - vt.y), (vt = { x: i.clientX, y: i.clientY }));
          return;
        }
        if (g !== "editor") return;
        if (G === "shore") {
          (Yo(i), n.shore29.pointerMove(je));
          return;
        }
        if (!Fe && !Le && !_t && !st.includes(G) && G !== "object" && G !== "scatter") return;
        if (U && $) {
          Yo(i);
          const Z = new t.Vector3(),
            ye = new t.Plane(new t.Vector3(0, 1, 0), -U.y);
          if (je.ray.intersectPlane(ye, Z)) {
            const nt = $.options;
            if (U.kind === "centre") fe(Z.x, Z.z) && Ut({ x: Z.x, z: Z.z, targetHeight: X(Z.x, Z.z) });
            else if (U.kind === "direction") Do(Z, !0);
            else {
              const xt = (nt.angle * Math.PI) / 180;
              Ut({ width: Ne(2 * Math.abs(-(Z.x - nt.x) * Math.sin(xt) + (Z.z - nt.z) * Math.cos(xt)), 1, 60) });
            }
          }
          return;
        }
        const d = po(i);
        if (!d) {
          de.visible = !1;
          return;
        }
        if (["ramp", "terrace"].includes(G) && $) {
          $.phase === "direction" && i.pointerType !== "touch" && Do(d);
          return;
        }
        if (
          (G === "object" &&
            (ve || ((ve = Ke.createPreview(Xe)), M.add(ve)),
            (ve.visible = !0),
            ve.position.set(d.x, x(d.x, d.z), d.z),
            (ve.rotation.y = (wo("[data-placement-rotation]", 0) * Math.PI) / 180),
            ve.scale.setScalar(wo("[data-placement-scale]", 1)),
            ve.traverse((Z) => {
              Z.material && Z.material.color.set(cn(d.x, d.z) ? 9687984 : 14514522);
            }),
            n.markDirty()),
          ["ramp", "terrace"].includes(G))
        ) {
          const Z = ao.activeOrigin || d,
            ye = (wo("[data-terrain-angle]", 0) * Math.PI) / 180,
            nt = Math.cos(ye),
            xt = Math.sin(ye),
            ot = wo("[data-terrain-width]", 6) / 2,
            tt = wo("[data-terrain-length]", 10) / 2,
            l = [
              [-tt, -ot],
              [tt, -ot],
              [tt, ot],
              [-tt, ot],
              [-tt, -ot],
              [-tt, 0],
              [tt * 0.8, 0],
              [tt * 0.55, -ot * 0.2],
              [tt * 0.8, 0],
              [tt * 0.55, ot * 0.2],
            ].map(([j, ie]) => {
              const ze = Z.x + j * nt - ie * xt,
                Ye = Z.z + j * xt + ie * nt;
              return new t.Vector3(ze, X(ze, Ye) + 0.18, Ye);
            });
          (ae.geometry.dispose(),
            (ae.geometry = new t.BufferGeometry().setFromPoints(l)),
            (ae.visible = !0),
            n.markDirty());
        }
        if (_t) {
          Qo(d);
          return;
        }
        if (Fe) {
          const Z = d.x + Fe.offset[0],
            ye = d.z + Fe.offset[1];
          (Fe.isObject ? cn(Z, ye) : K(Z, ye)) &&
            (Fe.isObject ? Ke.update(Fe.id, { x: Z, z: ye }) : T.update(Fe.id, { x: Z, z: ye }), Ft(), n.markDirty());
          return;
        }
        (st.includes(G) || G === "object" || G === "scatter") &&
          ((de.visible = !["ramp", "terrace"].includes(G)),
          de.position.set(d.x, d.y + 0.1, d.z),
          de.scale.setScalar(
            G === "object" || G === "scatter"
              ? Math.max(0.4, Ke.catalog.find((Z) => Z.id === Xe).radius * wo("[data-placement-scale]", 1))
              : ["ramp", "terrace"].includes(G)
                ? Math.hypot(wo("[data-terrain-width]", 6), wo("[data-terrain-length]", 10)) * 0.5
                : +c("[data-brush-radius]").value,
          ),
          n.markDirty(),
          Le && (Le.point = d));
      }));
    function Cn() {
      var i;
      if (
        ((i = n.shore29) == null || i.endDrag(),
        (U = null),
        (Ve = !1),
        _t && ((_t = null), Io(), We(), n.invalidate()),
        ao.endStroke(),
        Fe && ((Fe = null), n.invalidate(), We()),
        Le)
      ) {
        const d = Le.changed;
        ((Le = null), Kt());
        const Z = At();
        (We(),
          ne(
            d
              ? "Relief retouch\xE9. " + (Z.trees + Z.plants) + " v\xE9g\xE9taux retir\xE9s ; Annuler les restaure."
              : "Zone prot\xE9g\xE9e ou brosse trop petite pour ce maillage. Essayez un rayon plus large.",
            !d,
          ));
      }
      g === "editor" && (te.enabled = !0);
    }
    (C.addEventListener("pointerup", Cn),
      C.addEventListener("pointercancel", Cn),
      C.addEventListener("lostpointercapture", Cn),
      C.addEventListener("pointerleave", () => {
        (ve && (ve.visible = !1), Le || (ae.visible = !1), Le || ((de.visible = !1), n.markDirty()));
      }),
      document.addEventListener("mousemove", (i) => {
        g === "fly" && document.pointerLockElement === C && ea(i.movementX, i.movementY);
      }),
      document.addEventListener("pointerlockchange", () => {
        (An(),
          (c("[data-fly-hint]").textContent =
            document.pointerLockElement === C
              ? "ZQSD \xB7 Espace monter \xB7 Ctrl descendre \xB7 Maj acc\xE9l\xE9rer \xB7 \xC9chap lib\xE9rer la souris"
              : "Cliquez dans la vue pour piloter \xE0 la souris \xB7 Clic droit maintenu \xE9galement disponible"));
      }));
    const Zn = (i) => {
      var d, Z;
      return (
        /INPUT|SELECT|TEXTAREA/.test((d = i.target) == null ? void 0 : d.tagName) ||
        ((Z = i.target) == null ? void 0 : Z.isContentEditable)
      );
    };
    (document.addEventListener("keydown", (i) => {
      var Z, ye;
      const d = i.key.toLowerCase();
      if (g === "globe" && d === "escape") {
        (i.preventDefault(), Fn("orbit"));
        return;
      }
      if ((g === "editor" || g === "play") && d === "escape") {
        (i.preventDefault(), (ye = (Z = i.target) == null ? void 0 : Z.blur) == null || ye.call(Z), Fn("fly"));
        return;
      }
      if (!Zn(i)) {
        if (g === "fly" && d === "escape") {
          (An(), document.pointerLockElement === C && document.exitPointerLock());
          return;
        }
        (g === "fly" &&
          ["z", "q", "s", "d", "w", "a", " ", "control", "c", "shift"].includes(d) &&
          (i.preventDefault(), Me.add(d)),
          g === "editor" &&
            ((i.ctrlKey || i.metaKey) && d === "z" && (i.preventDefault(), i.shiftKey ? Jt() : Tt()),
            (i.ctrlKey || i.metaKey) && d === "y" && (i.preventDefault(), Jt()),
            (d === "delete" || d === "backspace") && (i.preventDefault(), un()),
            d === "enter" && $ ? (i.preventDefault(), fo()) : d === "enter" && G === "path" && _n()));
      }
    }),
      document.addEventListener("keyup", (i) => Me.delete(i.key.toLowerCase())),
      window.addEventListener("blur", () => {
        (An(), Cn());
      }),
      document.addEventListener("visibilitychange", () => {
        document.hidden && (An(), Cn());
      }),
      window.addEventListener("pagehide", () => {
        (pt !== null && We(), et && jt());
      }),
      P("[data-mode]").forEach((i) => i.addEventListener("click", () => Fn(i.dataset.mode))),
      P("[data-tool]").forEach((i) => i.addEventListener("click", () => zn(i.dataset.tool))),
      c("[data-tree-delete]").addEventListener("click", un),
      c("[data-tree-duplicate]").addEventListener("click", () => {
        const i = T.get(Qe);
        if (i) {
          for (const [d, Z] of [
            [3, 0],
            [-3, 0],
            [0, 3],
            [0, -3],
          ])
            if (K(i.x + d, i.z + Z)) {
              const { id: ye, x: nt, z: xt, ...ot } = i;
              Go(nt + d, xt + Z, ot);
              return;
            }
          ne("Aucune place libre \xE0 proximit\xE9 de cet arbre.", !0);
        }
      }),
      c("[data-tree-species]").addEventListener("change", (i) => {
        Qe && kn(Qe, { species: i.target.value, label: T.species[i.target.value].label });
      }));
    for (const i of ["height", "diameter", "spread"]) {
      const d = c("[data-tree-" + i + "]");
      (d.addEventListener("input", () => {
        Qe && (Pt(), T.update(Qe, { [i]: +d.value }), Ft(), n.invalidate());
      }),
        d.addEventListener("change", We));
    }
    for (const i of ["x", "z"])
      c("[data-tree-" + i + "]").addEventListener("change", (d) => {
        const Z = T.get(Qe);
        if (!Z) return;
        const ye = +d.target.value,
          nt = { ...Z, [i]: ye };
        K(nt.x, nt.z) ? kn(Qe, { [i]: ye }) : (Ft(), ne("Cette position est hors du terrain ou dans l\u2019eau.", !0));
      });
    for (const [i, d, Z] of [
      ["brush-radius", "brush-radius-value", " m"],
      ["brush-strength", "brush-strength-value", ""],
      ["path-width", "path-width-value", " m"],
      ["flight-speed", "flight-speed-value", " m/s"],
    ]) {
      const ye = c("[data-" + i + "]");
      ye.addEventListener("input", () => (c("[data-" + d + "]").textContent = ye.value + Z));
    }
    (c("[data-path-finish]").addEventListener("click", _n),
      c("[data-path-cancel]").addEventListener("click", () => {
        ((m = []), hn());
      }),
      c("[data-undo]").addEventListener("click", Tt),
      c("[data-redo]").addEventListener("click", Jt),
      c("[data-export-edits]").addEventListener("click", io),
      c("[data-import-edits]").addEventListener("click", () => c("[data-import-file]").click()),
      c("[data-import-file]").addEventListener("change", async (i) => {
        const d = i.target.files[0];
        if (d) {
          try {
            if (d.size > 3e7) throw Error("Le fichier est trop volumineux.");
            uo(JSON.parse(await d.text()));
          } catch (Z) {
            ne(Z.message || "Impossible de lire ce fichier.", !0);
          }
          i.target.value = "";
        }
      }),
      c("[data-flight-start]").addEventListener("click", () => {
        (S("promenade", !0), Fn("fly"));
      }));
    function f() {
      ((c("[data-source-state]").textContent = ke
        ? "Comparaison : version livr\xE9e \xB7 vos retouches sont conserv\xE9es"
        : rt
          ? "Mes retouches \xB7 sauvegarde de ce navigateur, aucun envoi automatique"
          : "Version livr\xE9e \xB7 aucune retouche locale charg\xE9e"),
        (c("[data-compare]").hidden = !rt && !ke),
        (c("[data-compare]").textContent = ke ? "Revenir \xE0 mes retouches" : "Voir la version livr\xE9e"),
        c("[data-compare]").setAttribute("aria-pressed", String(!!ke)));
    }
    function J(i = !ke) {
      if (i && !ke) (We(), et && jt(), (ke = bt()), Fn("orbit"), oo(Je));
      else if (!i && ke) {
        const d = ke;
        ((ke = null), oo(d));
      }
      return (f(), n.invalidate(), !!ke);
    }
    c("[data-compare]").addEventListener("click", () => J());
    for (const i of P("[data-fly-key]")) {
      const d = (Z) => {
        (Z.preventDefault(), Me.delete(i.dataset.flyKey));
      };
      (i.addEventListener("pointerdown", (Z) => {
        (Z.preventDefault(), Z.stopPropagation(), Me.add(i.dataset.flyKey), i.setPointerCapture(Z.pointerId));
      }),
        i.addEventListener("pointerup", d),
        i.addEventListener("pointercancel", d),
        i.addEventListener("lostpointercapture", d));
    }
    (c("[data-catalog-search]").addEventListener("input", sn),
      c("[data-catalog-category]").addEventListener("change", sn),
      c("[data-object-type]").replaceChildren(...Ke.catalog.map((i) => new Option(i.label, i.id))),
      c("[data-object-color]").addEventListener("change", (i) => {
        qe && rn(qe, { color: i.target.value });
      }),
      P("[data-object-color-preset]").forEach((i) =>
        i.addEventListener("click", () => {
          qe && rn(qe, { color: i.dataset.objectColorPreset });
        }),
      ),
      c("[data-object-color-reset]").addEventListener("click", () => {
        var d;
        const i = Ke.get(qe);
        if (i) {
          const Z = Ke.catalog.find((ye) => ye.id === i.type);
          rn(qe, { color: ((d = Z.variantColors) == null ? void 0 : d[i.variant]) || Z.defaultColor });
        }
      }),
      c("[data-object-type]").addEventListener("change", (i) => {
        qe && rn(qe, { type: i.target.value });
      }));
    for (const i of ["x", "z", "yOffset", "scale", "variant", "rotation"])
      c("[data-object-" + i + "]").addEventListener("change", (d) => {
        qe && rn(qe, { [i]: +d.target.value * (i === "rotation" ? Math.PI / 180 : 1) });
      });
    (c("[data-object-delete]").addEventListener("click", un),
      c("[data-object-duplicate]").addEventListener("click", mn),
      c("[data-object-list]").addEventListener("change", (i) => {
        const d = Dn(i.target.value);
        d &&
          (zn("select"),
          te.target.set(d.x, x(d.x, d.z) + 1, d.z),
          he.position.set(d.x + 5, x(d.x, d.z) + 7, d.z + 9),
          he.lookAt(te.target),
          n.markDirty());
      }),
      c("[data-editor-navigate]").addEventListener("change", () => {
        (Cn(),
          ne(
            c("[data-editor-navigate]").checked
              ? "Glissez pour tourner la vue. D\xE9cochez pour placer ou peindre."
              : "Outil actif. Touchez le terrain pour modifier.",
          ));
      }),
      c("[data-terrain-sample-altitude]").addEventListener("click", () => {
        ((Mt = !Mt),
          c("[data-terrain-sample-altitude]").setAttribute("aria-pressed", String(Mt)),
          ne(Mt ? "Touchez un point du sol pour relever sa hauteur." : "Pr\xE9l\xE8vement annul\xE9."));
      }));
    for (const [i, d, Z] of [
      ["radius", 0.5, 30],
      ["strength", 0.05, 6],
    ]) {
      const ye = c("[data-brush-" + i + "]"),
        nt = c("[data-brush-" + i + "-exact]");
      ((nt.value = ye.value),
        ye.addEventListener("input", () => (nt.value = ye.value)),
        nt.addEventListener("change", () => {
          ((nt.value = Ne(Number(nt.value) || d, d, Z)), (ye.value = nt.value), ye.dispatchEvent(new Event("input")));
        }));
    }
    (P("[data-terrain-preview-apply]").forEach((i) => i.addEventListener("click", fo)),
      (ct = c("[data-terrain-preview-cancel]")) == null || ct.addEventListener("click", vo),
      (gt = c("[data-terrain-preview-move]")) == null ||
        gt.addEventListener("click", () => {
          $ && (($.phase = "move"), It());
        }),
      (Gt = c("[data-terrain-preview-direction]")) == null ||
        Gt.addEventListener("click", () => {
          $ && (($.phase = "direction"), It());
        }),
      P("[data-terrain-rotate]").forEach((i) =>
        i.addEventListener("click", () => {
          $ && Ut({ angle: ($.options.angle + Number(i.dataset.terrainRotate) + 360) % 360 });
        }),
      ));
    for (const i of ["width", "length", "angle", "delta", "altitude", "one-sided"])
      (Ot = c("[data-terrain-" + i + "]")) == null || Ot.addEventListener("change", Xo);
    ((Xt = c("[data-brush-falloff]")) == null || Xt.addEventListener("change", Xo),
      (Wt = c("[data-path-delete-selected]")) == null || Wt.addEventListener("click", () => Eo(Ce)),
      c("[data-path-back]").addEventListener("click", () => {
        (m.pop(), hn());
      }));
    function Ze(i) {
      return (
        n.shore29.validate(i),
        Pt(),
        n.shore29.importContours(i),
        ao.clearProtectionCache(),
        Kt(),
        n.invalidate(),
        We(),
        !0
      );
    }
    if (n.shore29) {
      const i = c("[data-shore-pond]");
      (n.shore29.regions.forEach((d, Z) => {
        const ye = document.createElement("option");
        ((ye.value = Z), (ye.textContent = d.name.replaceAll("_", " ")), i.append(ye));
      }),
        n.shore29.attachUI({
          apply: Ze,
          notice: ne,
          state: (d) => {
            ((c("[data-shore-apply]").disabled = !d), (c("[data-shore-cancel]").disabled = !d));
          },
        }),
        i.addEventListener("change", () => n.shore29.select(i.value)));
      for (const [d, Z] of [
        ["apply", "apply"],
        ["cancel", "cancel"],
        ["reset", "reset"],
        ["focus", "focus"],
      ])
        c("[data-shore-" + d + "]").addEventListener("click", () => n.shore29[Z]());
    }
    (Io(), sn(), (c("[data-catalog-current]").textContent = Ke.catalog.find((i) => i.id === Xe).label), Oo());
    const Je = bt();
    Ct(Je);
    try {
      const i = localStorage.getItem(z);
      if (i) {
        const d = Ct(JSON.parse(i));
        (oo(d),
          (kt = i),
          (rt = !0),
          (c("[data-save-state]").textContent = "Vos derni\xE8res retouches ont \xE9t\xE9 restaur\xE9es"));
      }
    } catch {
      c("[data-save-state]").textContent =
        "La sauvegarde pr\xE9c\xE9dente n\u2019a pas pu \xEAtre restaur\xE9e. Votre fichier export\xE9 reste importable.";
    }
    return (
      f(),
      we(),
      To(),
      zn("select"),
      Xn(),
      hn(),
      {
        get mode() {
          return g;
        },
        get tool() {
          return G;
        },
        get selected() {
          return Ce || qe || Qe;
        },
        get selectedObject() {
          return qe;
        },
        props: Ke,
        terrainTools: ao,
        setShorelines29: Ze,
        get terrainPreview() {
          return $;
        },
        previewTerrain: eo,
        updateTerrainPreview: mo,
        applyTerrainPreview: fo,
        cancelTerrainPreview: vo,
        removePath: Eo,
        selectPath: an,
        restoreNativePath: tn,
        getPaths: Ko,
        chooseObject: Hn,
        selectObject: Dn,
        addObject: wn,
        setObject: rn,
        setCar24: No,
        removeObject: Bn,
        duplicateObject: mn,
        setMode: Fn,
        setTool: zn,
        beforeView: nn,
        tick: Jo,
        tickFlight: gn,
        selectTree: Bt,
        addTree: Go,
        setTree: kn,
        deleteSelected: un,
        editTerrain: fn,
        digGround24: on,
        openTreasure27: Ro,
        tickDigHoles25: ia,
        fillDigHoles25: So,
        getAdventure24: Ee,
        addPath: dn,
        undo: Tt,
        redo: Jt,
        compareOriginal: J,
        get comparingOriginal() {
          return !!ke;
        },
        exportDocument: () => ke || bt(),
        importDocument: uo,
        validateDocument: Ct,
        download: io,
        save: jt,
        initialDocument: Je,
        terrainAllowed: fe,
        groundPoint: po,
      }
    );
  }),
  (globalThis.MoulinGlobe26 = function (t, n) {
    "use strict";
    const { scene: A, model: re, camera: R, controls: he, renderer: te } = n,
      O = new t.Vector3(-7, 13, 14),
      T = 46,
      le = 41.8,
      X = 1,
      a = new t.Matrix4(),
      _e = new t.Matrix4(),
      pe = {
        globeInverseProjectionView26: { value: a },
        globeCentre26: { value: O },
        globeClip26: { value: 0 },
        globeRadius26: { value: new t.Vector3(le, T, X) },
      },
      q = new t.Vector3(),
      v = new Map(),
      k = new Set(),
      h = new Set(),
      b = [
        "enabled",
        "enablePan",
        "enableRotate",
        "enableZoom",
        "autoRotate",
        "autoRotateSpeed",
        "minDistance",
        "maxDistance",
        "minPolarAngle",
        "maxPolarAngle",
        "minAzimuthAngle",
        "maxAzimuthAngle",
        "enableDamping",
        "dampingFactor",
      ],
      p = () => (typeof n.weather == "function" ? n.weather() : n.weather),
      S = () => (typeof n.night == "function" ? n.night() : n.night),
      x = () => (typeof n.ambience == "function" ? n.ambience() : n.ambience);
    let c = !1,
      P = !1,
      C = !1,
      Ne = 0,
      z = null,
      ce = null,
      V = null,
      Me = null,
      je = null,
      lt = null,
      Ke = null,
      ve = null,
      qe = null,
      Xe = null,
      _t = null,
      Mt = 0,
      st = "",
      $ = 0,
      U = 0,
      He = 0;
    const Ce = new t.Color(),
      xe = {
        time: { value: 0 },
        night: { value: 0 },
        starry: { value: 0 },
        cover: { value: 0 },
        rain: { value: 0 },
        snow: { value: 0 },
        wind: { value: 0.2 },
        drift: { value: new t.Vector2() },
        centre: { value: O },
        cameraRight: { value: new t.Vector3(1, 0, 0) },
        cameraUp: { value: new t.Vector3(0, 1, 0) },
        cloudTint: { value: new t.Color("#eef5f3").convertSRGBToLinear() },
        sun32: globalThis.MoulinV32.uniforms.sunTrue,
        light32: globalThis.MoulinV32.uniforms.sunDirection,
        lightColour32: globalThis.MoulinV32.uniforms.sunColor,
        lightning32: globalThis.MoulinV32.uniforms.lightning,
        golden32: globalThis.MoulinV32.uniforms.golden,
      };
    function H(ue, se, Ve = !1) {
      const vt = /\bvoid\s+main\s*\(\s*(?:void)?\s*\)\s*\{/.exec(ue);
      if (!vt) throw new Error("Globe: shader main introuvable");
      const me = vt.index + vt[0].length;
      if (Ve)
        return (
          ue.slice(0, me) +
          `
` +
          se +
          `
` +
          ue.slice(me)
        );
      let Re = 1,
        et = me;
      for (; et < ue.length && Re; et++) ue[et] === "{" ? Re++ : ue[et] === "}" && Re--;
      if (Re) throw new Error("Globe: shader main incomplet");
      return (
        ue.slice(0, et - 1) +
        `
` +
        se +
        `
` +
        ue.slice(et - 1)
      );
    }
    function W(ue) {
      var kt;
      if (!ue || v.has(ue) || ((kt = ue.userData) != null && kt.globe26)) return;
      const se = ue.onBeforeCompile,
        Ve = ue.customProgramCacheKey,
        vt = (Ve == null ? void 0 : Ve.call(ue)) || "",
        me = k.has(ue),
        Re = function (M, ee) {
          (se == null || se.call(this, M, ee),
            Object.assign(M.uniforms, pe),
            (M.vertexShader =
              `uniform mat4 globeInverseProjectionView26;varying vec3 globeWorld26;
` +
              H(
                M.vertexShader,
                "vec4 globeFinalWorld26=globeInverseProjectionView26*gl_Position;globeWorld26=globeFinalWorld26.xyz/globeFinalWorld26.w;",
              )),
            me &&
              ((M.vertexShader =
                `varying float globeRootInside27;
` +
                H(
                  M.vertexShader,
                  `globeRootInside27=1.;
#ifdef USE_INSTANCING
vec3 globeRoot27=(modelMatrix*vec4(instanceMatrix[3].xyz,1.)).xyz;globeRootInside27=step(distance(globeRoot27.xz,globeCentre26.xz),globeRadius26.x-.4);
#endif`,
                )),
              (M.vertexShader =
                `uniform vec3 globeCentre26,globeRadius26;
` + M.vertexShader),
              (M.fragmentShader =
                `varying float globeRootInside27;
` + H(M.fragmentShader, "if(globeRootInside27<.5)discard;", !0))),
            (M.fragmentShader =
              `uniform vec3 globeCentre26,globeRadius26;uniform float globeClip26;varying vec3 globeWorld26;
` +
              H(
                M.fragmentShader,
                "if(globeClip26>.5){vec3 globeDelta26=globeWorld26-globeCentre26;if(dot(globeDelta26.xz,globeDelta26.xz)>globeRadius26.x*globeRadius26.x)discard;globeDelta26.y/=globeRadius26.z;if(dot(globeDelta26,globeDelta26)>globeRadius26.y*globeRadius26.y)discard;}",
                !0,
              )));
        },
        et = () => vt + "|moulin-globe27|" + (me ? "rooted-tree" : "world");
      (v.set(ue, { previous: se, previousKey: Ve, wrapped: Re, cacheKey: et }),
        (ue.onBeforeCompile = Re),
        (ue.customProgramCacheKey = et),
        (ue.needsUpdate = !0));
    }
    function D() {
      var se;
      if (!P) return;
      (re.traverse((Ve) => {
        var vt;
        if ((vt = Ve.userData) != null && vt.treeIds)
          for (const me of Array.isArray(Ve.material) ? Ve.material : [Ve.material]) me && k.add(me);
      }),
        re.traverse((Ve) => {
          for (const vt of Array.isArray(Ve.material) ? Ve.material : [Ve.material]) W(vt);
        }));
      const ue = p();
      for (const Ve of [
        ue == null ? void 0 : ue.particles,
        ue == null ? void 0 : ue.splashes,
        ue == null ? void 0 : ue.pondRings,
        ue == null ? void 0 : ue.pondDrops,
      ])
        Ve != null && Ve.material && W(Ve.material);
      (se = n.markDirty) == null || se.call(n);
    }
    function De(ue) {
      return (h.add(ue), ue);
    }
    function ke(ue) {
      const se = De(new t.ShaderMaterial(ue));
      return ((se.userData.globe26 = !0), (se.userData.night22 = !0), se);
    }
    function rt(ue, se, Ve) {
      const vt = new t.Mesh(De(ue), se);
      return (
        (vt.name = Ve),
        (vt.userData.globe26 = !0),
        (vt.userData.exportSkip = !0),
        (vt.castShadow = !1),
        (vt.receiveShadow = !1),
        z.add(vt),
        vt
      );
    }
    const $e =
        "varying vec3 globePoint,globeNormal;void main(){vec4 p=modelMatrix*vec4(position,1.);globePoint=p.xyz;globeNormal=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*p;}",
      B = `
#include <tonemapping_fragment>
#include <encodings_fragment>
`;
    function F() {
      var Rt, qt;
      if (c) return;
      ((c = !0),
        Ne++,
        (z = new t.Group()),
        (z.name = "Boule_de_neige_du_moulin_v27"),
        (z.visible = !1),
        (z.userData.exportSkip = !0),
        (z.userData.globe26 = !0),
        A.add(z));
      const ue = ke({
          depthTest: !1,
          depthWrite: !1,
          uniforms: { night: xe.night, cover: xe.cover },
          vertexShader: "varying vec2 q;void main(){q=uv;gl_Position=vec4(position.xy,1.,1.);}",
          fragmentShader: `uniform float night,cover;varying vec2 q;void main(){float glow=exp(-dot((q-vec2(.46,.69))*vec2(1.5,1.0),(q-vec2(.46,.69))*vec2(1.5,1.0))*2.3);vec3 day=mix(vec3(.40,.57,.69),vec3(.79,.92,.94),glow);day=mix(day,day*.88,cover*.33);vec3 dark=mix(vec3(.009,.023,.047),vec3(.030,.072,.12),glow);gl_FragColor=vec4(mix(day,dark,night),1.);${B}}`,
        }),
        se = rt(new t.PlaneGeometry(2, 2), ue, "Fond_doux_de_la_boule");
      ((se.frustumCulled = !1), (se.renderOrder = -1e3));
      const Ve = De(new t.SphereGeometry(T, n.mobile ? 48 : 72, n.mobile ? 32 : 48)),
        vt = ke({
          side: t.BackSide,
          depthWrite: !1,
          uniforms: {
            night: xe.night,
            cover: xe.cover,
            starry: xe.starry,
            centre: xe.centre,
            sun32: xe.sun32,
            lightning32: xe.lightning32,
            golden32: xe.golden32,
          },
          vertexShader: $e,
          fragmentShader: `uniform float night,cover,starry,lightning32,golden32;uniform vec3 centre,sun32;varying vec3 globePoint,globeNormal;void main(){float h=clamp((globePoint.y-centre.y+9.)/44.,0.,1.);vec3 daylight=mix(vec3(.72,.89,.94),vec3(.30,.62,.86),pow(h,.7));daylight=mix(daylight,mix(vec3(.52,.63,.67),vec3(.24,.36,.45),h),cover*.76);vec3 direction=normalize(globePoint-centre);
float toward=pow(max(dot(normalize(direction.xz+vec2(1e-4)),normalize(sun32.xz+vec2(1e-4))),0.)*.5+.5,2.);
daylight=mix(daylight,mix(vec3(1.,.55,.28),vec3(.78,.42,.5),1.-toward)*(.75+.25*(1.-h)),golden32*(1.-h*.55)*(1.-cover*.6));
float dusk=1.-smoothstep(-.16,.04,sun32.y);daylight=mix(daylight,mix(vec3(.3,.26,.44)*(.5+.5*toward),vec3(.05,.08,.2),h),dusk*.85);
vec3 nightSky=mix(vec3(.032,.072,.14),vec3(.008,.019,.051),h);float haze=exp(-pow((direction.x*.64+direction.z*.45+direction.y*.16-.24)*4.,2.));nightSky+=vec3(.018,.025,.046)*haze*starry;
vec3 c=mix(daylight,nightSky,night);c+=vec3(.5,.55,.75)*lightning32*(.3+.7*cover);gl_FragColor=vec4(c,1.);${B}}`,
        });
      ((je = rt(Ve, vt, "Ciel_interieur_de_la_boule")),
        je.position.copy(O),
        je.scale.setScalar(0.998),
        (je.renderOrder = -980));
      const me = ke({
          transparent: !0,
          depthWrite: !1,
          uniforms: { night: xe.night },
          vertexShader:
            "varying vec2 q;void main(){q=uv*2.-1.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
          fragmentShader: `uniform float night;varying vec2 q;void main(){float a=exp(-dot(q,q)*3.9)*(1.-smoothstep(.75,1.,length(q)))*mix(.26,.42,night);gl_FragColor=vec4(mix(vec3(.18,.28,.37),vec3(.003,.009,.02),night),a);${B}}`,
        }),
        Re = rt(new t.PlaneGeometry(110, 110), me, "Ombre_flottante_de_la_boule");
      ((Re.rotation.x = -Math.PI / 2), Re.position.set(O.x, O.y - T - 5.5, O.z), (Re.renderOrder = -990));
      const et = -0.7,
        kt = Math.acos((et - O.y) / T),
        M = Math.sqrt(T * T - (et - O.y) * (et - O.y)),
        ee = ke({
          side: t.FrontSide,
          uniforms: { night: xe.night, time: xe.time, wind: xe.wind, drift: xe.drift, centre: xe.centre, light32: xe.light32 },
          vertexShader: $e,
          fragmentShader: `uniform float night,time,wind;
uniform vec2 drift;
uniform vec3 centre,light32;
varying vec3 globePoint,globeNormal;
float speck28(vec3 p,float scale,float phase){
 vec3 cell=floor(p*scale),q=fract(p*scale)-.5;
 float seed=fract(sin(dot(cell,vec3(127.1,311.7,74.7)))*43758.54);
 q-=vec3(sin(seed*61.3),cos(seed*37.7),sin(seed*83.1))*.27;
 return (1.-smoothstep(.008,.067,length(q)))*step(.79,seed)*(.58+.42*sin(time*.8+phase+seed*16.));
}
void main(){
 vec3 n=normalize(globeNormal),v=normalize(cameraPosition-globePoint);
 float depth=clamp((-.70-globePoint.y)/32.3,0.,1.);
 float facing=pow(1.-abs(dot(v,n)),2.4);
 vec3 ray=refract(-v,n,.75),p=globePoint-centre+ray*(2.+depth*8.);
 p.xz+=drift*.022;
 float t=time*(.52+wind*.16);
 vec2 warp=vec2(sin(p.z*.24+t*.49),cos(p.x*.21-t*.39));
 vec2 q=vec2(p.x+p.z*.31,p.y*.83+p.z*.37)+warp*.82;
 float a=sin(q.x*.88+sin(q.y*.71-t*.73)),b=sin(q.y*.95+sin(q.x*.66+t*.64));
 float caustic=pow(max(0.,1.-abs(a+b)*.79),9.);
 float current=sin(q.x*.13+q.y*.17-t*.42)*sin(q.y*.19-q.x*.11+t*.23);
 float lit=.51+.49*max(0.,dot(n,normalize(light32)));
 vec3 shallow=mix(vec3(.011,.265,.335),vec3(.025,.36,.40),lit);
 vec3 c=mix(shallow,vec3(.006,.045,.11),smoothstep(.02,.98,depth));
 c+=vec3(.039,.20,.18)*caustic*pow(1.-depth,.8)*.57;
 c+=vec3(.008,.038,.046)*current*(.35+.65*(1.-depth));
 // Two world-space strata drift at different depths: suspended glints suggest
 // volume without particle objects, transparent sheets or another scene pass.
 float motes=speck28(p+vec3(time*.047,-time*.074,time*.023),.57,0.);
 motes+=speck28(p+ray*5.3+vec3(-time*.036,-time*.051,time*.037),.38,2.1)*.62;
 c+=vec3(.18,.40,.43)*motes*(.32+.68*(1.-depth));
 float beams=pow(max(0.,sin(p.x*.19+p.z*.14+sin(time*.19)*.20)),14.);
 c+=vec3(.012,.057,.06)*beams*pow(1.-depth,1.7);
 c=mix(c,vec3(.12,.39,.48)*mix(1.,.32,depth),facing*.30);
 float meniscus=1.-smoothstep(.025,.24,abs(globePoint.y+.70));
 c+=vec3(.14,.27,.29)*meniscus;
 gl_FragColor=vec4(c*mix(1.,.15,night),1.);
 ${B}
}
`,
        });
      rt(
        new t.SphereGeometry(T, n.mobile ? 48 : 72, n.mobile ? 20 : 28, 0, Math.PI * 2, kt, Math.PI - kt),
        ee,
        "Eau_bleue_arrondie_sous_le_domaine",
      ).position.copy(O);
      const ae = ke({
          side: t.DoubleSide,
          uniforms: { night: xe.night, time: xe.time, wind: xe.wind, drift: xe.drift, centre: xe.centre, light32: xe.light32, lightColour32: xe.lightColour32 },
          vertexShader: $e,
          fragmentShader: `uniform float night,time,wind;
uniform vec2 drift;
uniform vec3 centre,light32,lightColour32;
varying vec3 globePoint,globeNormal;
void main(){
 vec2 p=globePoint.xz-centre.xz+drift*.012;
 vec3 view=normalize(cameraPosition-globePoint);
 float speed=.73+wind*.55;
 float a=p.x*1.23+p.y*.43-time*speed+sin(p.y*.37+time*.24)*.44;
 float b=p.x*.49-p.y*1.81+time*.47;
 vec2 slope=vec2(cos(a)*.065+sin(b)*.026,cos(a)*.025-cos(b)*.054);
 vec3 normal=normalize(vec3(-slope.x,1.,-slope.y));
 float fresnel=.025+.70*pow(1.-max(dot(view,normal),0.),4.);
 float edge=smoothstep(41.6,44.0,length(p));
 vec3 c=mix(vec3(.008,.119,.164),vec3(.014,.20,.237),edge);
 c=mix(c,vec3(.18,.31,.39),fresnel);
 float crest=pow(max(0.,sin(a)*.7+sin(b)*.3),11.);
 float broken=.35+.65*smoothstep(-.2,.8,sin(p.y*.83+time*.31));
 c+=vec3(.12,.25,.26)*crest*broken*.23;
 float glint=pow(max(dot(normal,normalize(view+normalize(light32))),0.),94.);
 c+=lightColour32*.5*glint*(1.-night);
 c+=vec3(.12,.25,.27)*(1.-smoothstep(.035,.21,abs(length(p)-43.91)))*.50;
 gl_FragColor=vec4(c*mix(1.,.15,night),1.);
 ${B}
}
`,
        }),
        de = rt(new t.CircleGeometry(M - 0.012, n.mobile ? 64 : 96), ae, "Surface_bleue_autour_du_domaine");
      ((de.rotation.x = -Math.PI / 2), de.position.set(O.x, et, O.z));
      const oe = [],
        y = [],
        I = 144;
      for (let Kt = 0; Kt <= I; Kt++) {
        const ro = (Kt / I) * Math.PI * 2,
          oo = O.x + Math.cos(ro) * le,
          uo = O.z + Math.sin(ro) * le;
        let Tt = ((Rt = n.terrainHeight) == null ? void 0 : Rt.call(n, oo, uo)) ?? 0;
        if (((Tt = Math.max(-0.62, Math.min(11, Tt))), oe.push(oo, Tt, uo, oo, -1.55, uo), Kt < I)) {
          const Jt = Kt * 2;
          y.push(Jt, Jt + 2, Jt + 1, Jt + 2, Jt + 3, Jt + 1);
        }
      }
      const Be = new t.BufferGeometry();
      (Be.setAttribute("position", new t.Float32BufferAttribute(oe, 3)), Be.setIndex(y), Be.computeVertexNormals());
      const Se = ke({
        side: t.DoubleSide,
        uniforms: { night: xe.night },
        vertexShader: $e,
        fragmentShader: `uniform float night;varying vec3 globePoint,globeNormal;void main(){float lit=.52+.34*max(0.,dot(normalize(globeNormal),normalize(vec3(-.5,1.,.6))));vec3 soil=mix(vec3(.16,.18,.10),vec3(.24,.25,.14),smoothstep(-.8,2.,globePoint.y));soil=mix(vec3(.028,.15,.19),soil,smoothstep(-1.1,-.5,globePoint.y));gl_FragColor=vec4(soil*lit*mix(1.,.46,night),1.);${B}}`,
      });
      rt(Be, Se, "Tranche_du_sol_de_la_boule");
      const N = ke({
        transparent: !0,
        depthWrite: !1,
        side: t.FrontSide,
        blending: t.AdditiveBlending,
        uniforms: { night: xe.night, right26: xe.cameraRight, up26: xe.cameraUp, centre: xe.centre },
        vertexShader: $e,
        fragmentShader: `uniform float night;uniform vec3 centre,right26,up26;varying vec3 globePoint,globeNormal;void main(){vec3 n=normalize(globeNormal),v=normalize(cameraPosition-globePoint);float edge=1.-abs(dot(v,n));float rim=pow(edge,5.6);float x=dot(n,right26),y=dot(n,up26);float ellipse=pow((x+.73)/.20,2.)+pow((y-.35)/.58,2.);float streak=exp(-pow((ellipse-1.)*19.,2.))*smoothstep(-.35,.28,y)*(1.-smoothstep(-.02,.25,x));float inner=exp(-pow((ellipse-1.13)*25.,2.))*.23*smoothstep(.24,.66,y);float pin=exp(-((x+.60)*(x+.60)*200.+(y-.57)*(y-.57)*900.));float a=rim*.38+streak*.115+inner*.05+pin*.08;if(a<.0018)discard;vec3 c=mix(vec3(.69,.91,.98),vec3(.40,.65,.93),night);gl_FragColor=vec4(c,a);${B}}`,
      });
      ((lt = rt(Ve, N, "Verre_poli_reflets_courbes_de_la_boule")),
        lt.position.copy(O),
        lt.scale.setScalar(1.0055),
        (lt.renderOrder = 35));
      const Ie = n.mobile ? 16 : 24,
        E = 7,
        Y = Ie * E,
        w = new t.InstancedBufferGeometry(),
        be = De(new t.SphereGeometry(1, n.mobile ? 12 : 16, n.mobile ? 8 : 10));
      ((w.index = be.index),
        (w.attributes.position = be.attributes.position),
        (w.attributes.normal = be.attributes.normal));
      const ne = new Float32Array(Y * 4),
        K = new Float32Array(Y * 4),
        fe = new Float32Array(Y * 3),
        Ee = [
          [0, 0, 0],
          [-0.74, -0.17, 0],
          [0.69, -0.2, 0.09],
          [-0.26, 0.25, -0.35],
          [0.3, 0.3, -0.18],
          [-0.4, -0.15, 0.42],
          [0.43, -0.13, 0.39],
        ];
      for (let Kt = 0; Kt < Ie; Kt++)
        for (let ro = 0; ro < E; ro++) {
          const oo = Kt * E + ro,
            uo = 0.86 + ((Kt * 0.438731) % 1) * 0.29,
            Tt = Ee[ro];
          (ne.set(
            [(Kt * 0.618033 + 0.09) % 1, (Kt * 0.754877 + 0.13) % 1, (Kt * 0.569841 + 0.32) % 1, Kt / (Ie - 1)],
            oo * 4,
          ),
            K.set(
              [
                (ro === 0 ? 5.9 : 4.25) * uo,
                (ro === 0 ? 4.55 : 3.8) * uo,
                (ro === 0 ? 4.55 : 3.6) * uo,
                ro * 0.34 + Kt * 0.61,
              ],
              oo * 4,
            ),
            fe.set([Tt[0] * 7.2 * uo, Tt[1] * 5.8 * uo, Tt[2] * 7.7 * uo], oo * 3));
        }
      (w.setAttribute("cloudSeed27", new t.InstancedBufferAttribute(ne, 4)),
        w.setAttribute("cloudShape27", new t.InstancedBufferAttribute(K, 4)),
        w.setAttribute("cloudOffset27", new t.InstancedBufferAttribute(fe, 3)),
        (w.instanceCount = Y));
      const bt = ke({
        side: t.FrontSide,
        uniforms: {
          time: xe.time,
          cover: xe.cover,
          night: xe.night,
          wind: xe.wind,
          drift: xe.drift,
          centre: xe.centre,
          light32: xe.light32,
          lightColour32: xe.lightColour32,
          lightning32: xe.lightning32,
          golden32: xe.golden32,
        },
        vertexShader:
          "attribute vec4 cloudSeed27,cloudShape27;attribute vec3 cloudOffset27;uniform float time,cover,wind,night;uniform vec2 drift;uniform vec3 centre;varying vec3 cloudWorld27,cloudNormal27;varying float cloudVisible27,cloudLocal27,cloudSeedValue27;void main(){vec2 p=mod((cloudSeed27.xy-.5)*112.+drift+56.,112.)-56.;float h=36.0+cloudSeed27.z*7.0;float size=.78+cover*.26;vec3 puffCentre=vec3(centre.x+p.x,h,centre.z+p.y)+cloudOffset27*size;float puffRadius=max(cloudShape27.x,max(cloudShape27.y,cloudShape27.z))*size;float fit=clamp((45.15-length(puffCentre-centre))/puffRadius,0.,1.);vec3 world=puffCentre+position*cloudShape27.xyz*size*fit;cloudWorld27=world;cloudNormal27=normalize(normal/cloudShape27.xyz);cloudVisible27=step(cloudSeed27.w,mix(mix(.59,.18,night),1.,cover))*step(.015,fit);cloudLocal27=position.y;cloudSeedValue27=cloudShape27.w;gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);}",
        fragmentShader: `uniform float cover,night,time,lightning32,golden32;uniform vec3 centre,light32,lightColour32;varying vec3 cloudWorld27,cloudNormal27;varying float cloudVisible27,cloudLocal27,cloudSeedValue27;void main(){if(cloudVisible27<.5||length(cloudWorld27-centre)>45.3)discard;vec3 n=normalize(cloudNormal27);float top=dot(n,normalize(light32))*.5+.5;float puffShade=.68+.32*smoothstep(-.9,.75,cloudLocal27);float detail=sin(cloudWorld27.x*.77+cloudWorld27.z*.34)*sin(cloudWorld27.y*.91-cloudWorld27.z*.28)*.035;vec3 c=mix(vec3(.41,.52,.60),vec3(.98,.99,.96),top)*puffShade;float under=1.-smoothstep(-.50,.15,n.y);c*=1.-under*cover*.22;c=mix(c,c*vec3(.37,.46,.55),cover*.66);c+=detail;c*=mix(vec3(1.),lightColour32*vec3(1.08,.95,.9),golden32*.8);c=mix(c,vec3(.050,.091,.16)*(.63+top*.73)*puffShade,night);c+=vec3(.55,.6,.8)*lightning32*(.4+.6*(1.-top));gl_FragColor=vec4(c,1.);${B}}`,
      });
      ((V = rt(w, bt, "Nuages_volumineux_dans_la_boule")), (V.frustumCulled = !1));
      const mt = De(new t.SphereGeometry(1, 24, 16)),
        Ct = (Kt) =>
          ke({
            uniforms: { night: xe.night, golden32: xe.golden32, sun32: xe.sun32 },
            vertexShader: $e,
            fragmentShader:
              Kt === "sun"
                ? `uniform float golden32;varying vec3 globePoint,globeNormal;void main(){gl_FragColor=vec4(mix(vec3(1.,.86,.55),vec3(1.,.5,.2),golden32)*1.25,1.);${B}}`
                : `uniform vec3 sun32;varying vec3 globePoint,globeNormal;void main(){vec3 n=normalize(globeNormal);float lit=smoothstep(-.08,.16,dot(n,normalize(sun32)));float crater=sin(n.x*23.+n.y*13.)*sin(n.y*19.-n.z*17.)*.027;gl_FragColor=vec4(vec3(.72,.82,.96)*(.05+lit*1.05+crater),1.);${B}}`,
          });
      ((Ke = rt(mt, Ct("sun"), "Soleil_bas_dans_la_boule")),
        Ke.position.set(O.x - 20, 37.5, O.z - 10),
        Ke.scale.setScalar(3.25),
        (ve = rt(mt, Ct("moon"), "Lune_dans_la_boule")),
        ve.position.copy(Ke.position),
        ve.scale.setScalar(3.05));
      const Pt = n.mobile ? 160 : 260,
        jt = new Float32Array(Pt * 3),
        Dt = new Float32Array(Pt * 2);
      for (let Kt = 0; Kt < Pt; Kt++) {
        const ro = 0.2 + ((Kt + 0.5) / Pt) * 0.77,
          oo = Kt * 2.39996323,
          uo = Math.sqrt(1 - ro * ro);
        (jt.set([O.x + Math.cos(oo) * uo * 45.45, O.y + ro * 45.45, O.z + Math.sin(oo) * uo * 45.45], Kt * 3),
          Dt.set([0.74 + ((Kt * 0.754877) % 1) * 0.58, (Kt * 0.438731) % 1], Kt * 2));
      }
      const we = De(new t.BufferGeometry());
      (we.setAttribute("position", new t.BufferAttribute(jt, 3)),
        we.setAttribute("starSeed27", new t.BufferAttribute(Dt, 2)));
      const We = ke({
        transparent: !0,
        depthWrite: !1,
        uniforms: {
          time: xe.time,
          cover: xe.cover,
          centre: xe.centre,
          pixelRatio: { value: Math.min(2, ((qt = te.getPixelRatio) == null ? void 0 : qt.call(te)) || 1) },
        },
        vertexShader:
          "attribute vec2 starSeed27;uniform float time,pixelRatio;uniform vec3 centre;varying float starGain27,starTint27,starBack27;void main(){starBack27=1.-step(0.,dot(normalize(position-centre),normalize(cameraPosition-centre)));starGain27=starSeed27.x*(.76+.24*sin(time*.73+starSeed27.y*23.));starTint27=starSeed27.y;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=(2.0+starSeed27.x*1.35)*pixelRatio;}",
        fragmentShader: `uniform float cover;varying float starGain27,starTint27,starBack27;void main(){if(starBack27<.5)discard;float d=length(gl_PointCoord-.5);float core=1.-smoothstep(.10,.46,d);float halo=exp(-d*d*14.)*.12;float a=(core+halo)*starGain27*(1.-cover*.72);if(a<.025)discard;gl_FragColor=vec4(mix(vec3(.72,.84,1.),vec3(1.,.91,.77),starTint27),a);${B}}`,
      });
      ((qe = new t.Points(we, We)),
        (qe.name = "Etoiles_interieures_de_la_boule"),
        (qe.frustumCulled = !1),
        (qe.renderOrder = -970),
        (qe.userData.globe26 = qe.userData.night22 = qe.userData.exportSkip = !0),
        z.add(qe));
      const yt = new t.BufferGeometry(),
        Ft = new Float32Array(54);
      (yt.setAttribute("position", new t.BufferAttribute(Ft, 3).setUsage(t.DynamicDrawUsage)), yt.setDrawRange(0, 0));
      const Bt = De(new t.MeshBasicMaterial({ color: 2176568, side: t.DoubleSide, fog: !1 }));
      ((Bt.userData.night22 = !0),
        (Bt.userData.globe26 = !0),
        (Me = rt(yt, Bt, "Oiseaux_de_passage_dans_la_boule")),
        (Me.frustumCulled = !1),
        (Xe = new t.HemisphereLight(11717370, 3165023, 0)),
        (Xe.name = "Lumiere_de_presentation_boule"),
        (Xe.userData.night22 = !0),
        z.add(Xe),
        (_t = new t.DirectionalLight(11258619, 0)),
        (_t.name = "Clair_de_lune_boule"),
        _t.position.set(O.x - 26, O.y + 36, O.z + 31),
        _t.target.position.set(O.x, 1, O.z),
        (_t.castShadow = !1),
        (_t.userData.night22 = !0),
        z.add(_t, _t.target));
    }
    function g() {
      (R.updateMatrixWorld(!0),
        _e.multiplyMatrices(R.projectionMatrix, R.matrixWorldInverse),
        a.copy(_e).invert(),
        xe.cameraRight.value.setFromMatrixColumn(R.matrixWorld, 0),
        xe.cameraUp.value.setFromMatrixColumn(R.matrixWorld, 1));
    }
    function G() {
      const se = t.MathUtils.degToRad(42) * 0.5,
        Ve = Math.atan(Math.tan(se) * Math.max(0.25, R.aspect)),
        vt = (T * 1.12) / Math.sin(Math.min(se, Ve)),
        me = new t.Vector3(0.13, 0.16, 1).normalize();
      return { position: O.clone().addScaledVector(me, vt).toArray(), target: O.toArray(), fov: 42, distance: vt };
    }
    function Qe() {
      var vt;
      if (!P) return !1;
      const ue = he.autoRotate,
        se = he.enableDamping;
      ((he.autoRotate = !1), (he.enableDamping = !1), he.update());
      const Ve = G();
      return (
        R.position.fromArray(Ve.position),
        (R.fov = Ve.fov),
        R.updateProjectionMatrix(),
        he.target.copy(O),
        (he.minDistance = Ve.distance * 0.76),
        (he.maxDistance = Ve.distance * 1.35),
        he.update(),
        (he.autoRotate = ue),
        (he.enableDamping = se),
        g(),
        (vt = n.markDirty) == null || vt.call(n),
        !0
      );
    }
    function Fe() {
      var se, Ve, vt, me, Re, et, kt, M;
      if (C || P) return !1;
      F();
      const ue = {};
      for (const ee of b) ue[ee] = he[ee];
      return (
        (ce = {
          position: R.position.clone(),
          quaternion: R.quaternion.clone(),
          fov: R.fov,
          target: he.target.clone(),
          controls: ue,
          background:
            ((Ve = (se = A.background) == null ? void 0 : se.clone) == null ? void 0 : Ve.call(se)) || A.background,
          fog: ((me = (vt = A.fog) == null ? void 0 : vt.clone) == null ? void 0 : me.call(vt)) || A.fog,
          skyVisible: (et = (Re = p()) == null ? void 0 : Re.sky) == null ? void 0 : et.visible,
          starsVisible: (M = (kt = S()) == null ? void 0 : kt.stars) == null ? void 0 : M.visible,
        }),
        (P = !0),
        (pe.globeClip26.value = 1),
        (z.visible = !0),
        (he.enabled = !0),
        (he.enablePan = !1),
        (he.enableRotate = !0),
        (he.enableZoom = !0),
        (he.autoRotate = !0),
        (he.autoRotateSpeed = 0.35),
        (he.minPolarAngle = 0.72),
        (he.maxPolarAngle = 1.48),
        (he.minAzimuthAngle = -1 / 0),
        (he.maxAzimuthAngle = 1 / 0),
        (he.enableDamping = !0),
        Qe(),
        D(),
        (st = ""),
        m(0, Mt),
        !0
      );
    }
    function Le() {
      pe.globeClip26.value = 0;
      for (const [ue, se] of v)
        (ue.onBeforeCompile === se.wrapped && (ue.onBeforeCompile = se.previous),
          ue.customProgramCacheKey === se.cacheKey && (ue.customProgramCacheKey = se.previousKey),
          (ue.needsUpdate = !0));
      v.clear();
    }
    function pt() {
      var Ve, vt, me, Re, et, kt, M, ee, ge, ae, de, oe, y, I, Be;
      if (!P) return !1;
      ((P = !1), (z.visible = !1), Le());
      const ue = p(),
        se = S();
      if (((he.autoRotate = !1), (he.enableDamping = !1), he.update(), ce)) {
        (R.position.copy(ce.position),
          R.quaternion.copy(ce.quaternion),
          (R.fov = ce.fov),
          R.updateProjectionMatrix(),
          he.target.copy(ce.target));
        for (const E of b) he[E] = ce.controls[E];
        ((A.background = ce.background), (A.fog = ce.fog));
        const Se = ((Ve = se == null ? void 0 : se.getState) == null ? void 0 : Ve.call(se).mode) || "day";
        (ue != null && ue.sky && (ue.sky.visible = Se !== "black"),
          se != null && se.stars && (se.stars.visible = Se === "stars"));
        const N = (ue == null ? void 0 : ue.mode) || "sun",
          Ie = (me = (vt = ue == null ? void 0 : ue.modes) == null ? void 0 : vt[N]) == null ? void 0 : me.sky;
        (Se === "day" && Ie
          ? ((A.background = new t.Color(Ie).convertSRGBToLinear()), A.fog && A.fog.color.copy(A.background))
          : Se !== "day" &&
            ((A.background = new t.Color(Se === "black" ? 132106 : 66314)), A.fog && A.fog.color.copy(A.background)),
          (Re = ue == null ? void 0 : ue.uniforms) != null &&
            Re.fogDensity &&
            (ue.uniforms.fogDensity.value =
              ((kt = (et = ue == null ? void 0 : ue.modes) == null ? void 0 : et[N]) == null ? void 0 : kt.fog) || 0),
          A.fog &&
            (A.fog.density =
              ((ee = (M = ue == null ? void 0 : ue.modes) == null ? void 0 : M[N]) == null ? void 0 : ee.fog) || 0),
          (de =
            (ae = (ge = ue == null ? void 0 : ue.particles) == null ? void 0 : ge.material) == null
              ? void 0
              : ae.uniforms) != null &&
            de.centre &&
            ue.particles.material.uniforms.centre.value.copy(R.position),
          (I =
            (y = (oe = ue == null ? void 0 : ue.particles) == null ? void 0 : oe.material) == null
              ? void 0
              : y.uniforms) != null &&
            I.extent &&
            (ue.particles.material.uniforms.extent.value = t.MathUtils.clamp(R.position.y * 0.85 + 58, 64, 240)));
      }
      return ((ce = null), (te.shadowMap.needsUpdate = !0), (Be = n.markDirty) == null || Be.call(n), !0);
    }
    function Ge(ue) {
      var se;
      if (!P) return !1;
      if (((he.autoRotate = !!ue), !ue)) {
        const Ve = R.position.clone(),
          vt = R.quaternion.clone(),
          me = he.target.clone(),
          Re = he.enableDamping;
        ((he.enableDamping = !1),
          he.update(),
          R.position.copy(Ve),
          R.quaternion.copy(vt),
          he.target.copy(me),
          (he.enableDamping = Re),
          g());
      }
      return ((se = n.markDirty) == null || se.call(n), he.autoRotate);
    }
    const globe32Dusk = new t.Color("#27324d").convertSRGBToLinear(),
      globe32Golden = new t.Color("#efc3a0").convertSRGBToLinear();
    // V32 : le soleil et la lune suivent leur vraie course dans la boule.
    function globe32PlaceSky(night, cover) {
      const V32 = globalThis.MoulinV32,
        sunDir = V32.uniforms.sunTrue.value,
        moonDir = V32.uniforms.moonDirection.value;
      (Ke.position.set(O.x + sunDir.x * 35, O.y + Math.max(sunDir.y, -0.1) * 30 + 2, O.z + sunDir.z * 35),
        (Ke.visible = !night && sunDir.y > -0.04 && cover < 0.84),
        ve.position.set(O.x + moonDir.x * 33, O.y + Math.max(moonDir.y, -0.1) * 28 + 2, O.z + moonDir.z * 33),
        (ve.visible = (night || V32.uniforms.daylight.value < 0.55) && moonDir.y > -0.03 && cover < 0.9));
    }
    function m(ue, se) {
      var de, oe, y, I, Be, Se, N, Ie, E, Y, w, be, ne, K, fe, Ee, bt, mt, Ct, Pt;
      if (!P) return !1;
      ((ue = t.MathUtils.clamp(Number(ue) || 0, 0, 0.15)),
        (Mt = Number.isFinite(se) ? se : Mt + ue),
        (xe.time.value = Mt));
      const Ve = p(),
        vt = ((oe = (de = S()) == null ? void 0 : de.getState) == null ? void 0 : oe.call(de)) || { mode: "day" },
        me = (Ve == null ? void 0 : Ve.mode) || "sun",
        Re = vt.mode !== "day";
      ((xe.night.value = Re ? 1 : Math.pow(1 - globalThis.MoulinV32.uniforms.daylight.value, 1.7)),
        (xe.starry.value = vt.mode === "stars" ? 1 : 0),
        (xe.cover.value =
          ((I = (y = Ve == null ? void 0 : Ve.uniforms) == null ? void 0 : y.cover) == null ? void 0 : I.value) ??
          (me === "sun" ? 0.15 : me === "storm" ? 1 : 0.7)),
        (xe.rain.value =
          ((Se = (Be = Ve == null ? void 0 : Ve.uniforms) == null ? void 0 : Be.rain) == null ? void 0 : Se.value) ||
          0),
        (xe.snow.value =
          ((Ie = (N = Ve == null ? void 0 : Ve.uniforms) == null ? void 0 : N.snow) == null ? void 0 : Ie.value) || 0));
      const et = x(),
        kt = ((E = et == null ? void 0 : et.windDirection) == null ? void 0 : E.value) || { x: 0.83, y: 0.56 };
      (($ = t.MathUtils.clamp(
        ((Y = et == null ? void 0 : et.wind) == null ? void 0 : Y.value) ??
          ((w = Ve == null ? void 0 : Ve.getState) == null ? void 0 : w.call(Ve).wind) ??
          0.2,
        0,
        1.8,
      )),
        (xe.wind.value = $));
      const M = 0.45 + $ * 3.3;
      ((xe.drift.value.x += kt.x * ue * M),
        (xe.drift.value.y += (kt.y ?? kt.z ?? 0.56) * ue * M),
        (U += ue * M),
        Ve != null && Ve.sky && (Ve.sky.visible = !1),
        (be = S()) != null && be.stars && (S().stars.visible = !1),
        A.fog && ((A.fog.density = me === "fog" ? 0.012 : 0), me === "fog" && A.fog.color.set(Re ? 1716530 : 13421772)),
        (ne = Ve == null ? void 0 : Ve.uniforms) != null && ne.fogDensity && (Ve.uniforms.fogDensity.value = me === "fog" ? 0.012 : 0));
      const ee = me + "|" + vt.mode;
      (((st = ee),
        Ce.set(Re ? "#14253d" : me === "sun" || me === "partly" ? "#c5dce4" : "#b4cbd5").convertSRGBToLinear(),
        Re ||
          Ce.lerp(globe32Dusk, 1 - globalThis.MoulinV32.uniforms.daylight.value).lerp(
            globe32Golden,
            globalThis.MoulinV32.uniforms.golden.value * 0.45,
          )),
        (K = A.background) != null && K.isColor ? A.background.copy(Ce) : (A.background = Ce.clone()),
        (bt =
          (Ee = (fe = Ve == null ? void 0 : Ve.particles) == null ? void 0 : fe.material) == null
            ? void 0
            : Ee.uniforms) != null &&
          bt.centre &&
          Ve.particles.material.uniforms.centre.value.set(O.x, 12, O.z),
        (Pt =
          (Ct = (mt = Ve == null ? void 0 : Ve.particles) == null ? void 0 : mt.material) == null
            ? void 0
            : Ct.uniforms) != null &&
          Pt.extent &&
          (Ve.particles.material.uniforms.extent.value = 94),
        globe32PlaceSky(Re, xe.cover.value),
        (qe.visible = vt.mode === "stars"),
        (Xe.intensity = Re ? (vt.mode === "stars" ? 0.38 : 0.26) : 0),
        (_t.intensity = Re ? (vt.mode === "stars" ? 0.42 : 0.26) : 0),
        (Xe.visible = _t.visible = Re));
      const ge = (Mt + 4) % 31,
        ae = (me === "sun" || me === "partly") && !Re && ge < 10;
      if (((Me.visible = ae), (He = ae ? 3 : 0), Me.geometry.setDrawRange(0, ae ? 18 : 0), ae)) {
        const jt = Me.geometry.attributes.position.array;
        for (let Dt = 0; Dt < 3; Dt++) {
          const we = ge / 10,
            We = O.x - 27 + we * 54 - Dt * 2.4,
            yt = O.z + 8 - Dt * 1.65,
            Ft = 22 + Math.sin(we * Math.PI) * 3 + Dt * 0.75,
            Bt = Math.sin(Mt * 8.5 + Dt) * 0.46;
          jt.set(
            [
              We,
              Ft,
              yt,
              We - 0.76,
              Ft + Bt,
              yt - 0.16,
              We - 0.12,
              Ft,
              yt + 0.23,
              We,
              Ft,
              yt,
              We + 0.76,
              Ft + Bt,
              yt - 0.16,
              We + 0.12,
              Ft,
              yt + 0.23,
            ],
            Dt * 18,
          );
        }
        Me.geometry.attributes.position.needsUpdate = !0;
      }
      return (g(), !0);
    }
    function at() {
      var ue, se;
      return {
        active: P,
        built: c,
        builds: Ne,
        patchedMaterials: v.size,
        clouds: (V == null ? void 0 : V.geometry.instanceCount) || 0,
        birds: He,
        skyHidden: P && ((se = (ue = p()) == null ? void 0 : ue.sky) == null ? void 0 : se.visible) === !1,
        rotating: P && !!he.autoRotate,
        centre: O.toArray(),
        radius: T,
        landRadius: le,
        cloudHeight: [28, 50],
        starsVisible: P && !!(qe != null && qe.visible),
        starCount: (qe == null ? void 0 : qe.geometry.attributes.position.count) || 0,
        nightFill: (P && (Xe == null ? void 0 : Xe.intensity)) || 0,
        roundSphere: !0,
        wind: $,
        cloudDistance: U,
        globeDraws: c ? 12 : 0,
        preset: G(),
        clipEnabled: pe.globeClip26.value,
        resources: h.size,
      };
    }
    function ft() {
      var ue;
      (pt(), (C = !0), z && A.remove(z));
      for (const se of h) (ue = se.dispose) == null || ue.call(se);
      h.clear();
    }
    return {
      enter: Fe,
      exit: pt,
      update: m,
      recenter: Qe,
      setRotating: Ge,
      refreshMaterials: D,
      preset: G,
      getState: at,
      dispose: ft,
      get group() {
        return z;
      },
      clipUniforms: pe,
    };
  }),
  (globalThis.MoulinInteractions25 = function (t, n) {
    "use strict";
    var Ke;
    const { root: A, model: re, player: R, props: he, camera: te, renderer: O } = n,
      T = A.ownerDocument,
      le = new t.Vector3(),
      X = new t.Vector3(),
      a = new t.Vector3(),
      pe = [
        ["Panneaux_Moulin_de_Saint_Christophe_Crokmouland", "Bienvenue au moulin", !1],
        ["Panneau_des_commandes_du_domaine_v24", "Les commandes du domaine", !0],
      ]
        .map(([ve, qe, Xe]) => ({ object: re.getObjectByName(ve), title: qe, guide: Xe }))
        .filter((ve) => ve.object),
      q = (ve, qe) => {
        const Xe = T.createElement("button");
        return (
          (Xe.type = "button"),
          (Xe.className = "world25-prompt"),
          (Xe.textContent = ve),
          (Xe.hidden = !0),
          Xe.setAttribute("aria-label", qe),
          (Xe.title = qe),
          A.appendChild(Xe),
          Xe
        );
      },
      v = q("E", "Monter dans le v\xE9hicule"),
      k = q("L", "Lire le panneau");
    ((v.dataset.vehiclePrompt25 = ""), (k.dataset.signPrompt25 = ""));
    const h = T.createElement("section");
    ((h.className = "sign25-dialog"),
      (h.hidden = !0),
      h.setAttribute("role", "dialog"),
      h.setAttribute("aria-modal", "true"),
      h.setAttribute("aria-labelledby", "sign25-title"),
      (h.innerHTML =
        '<div class="sign25-card"><p class="sign25-eyebrow">MOULIN DE SAINT CHRISTOPHE</p><h2 id="sign25-title"></h2><div data-sign25-content></div><button type="button" class="btn">Reprendre la promenade</button></div>'),
      A.appendChild(h));
    const b = T.createElement("button");
    ((b.type = "button"),
      (b.className = "player26-exit"),
      (b.dataset.exit26 = ""),
      (b.textContent = "Descendre"),
      (b.hidden = !0),
      b.addEventListener("click", () => R.dismountVehicle()),
      (Ke = A.querySelector(".player19-actions")) == null || Ke.appendChild(b));
    const p = [
      ["ZQSD / Fl\xE8ches", "Marcher ou conduire"],
      ["Souris / Glisser", "Regarder autour de soi"],
      ["E", "Monter ou descendre du v\xE9hicule"],
      ["L", "Lire un panneau \xE0 proximit\xE9"],
      ["R", "Creuser \xE0 pied"],
      ["F", "Allumer la lampe, la nuit"],
      ["Maj", "Courir ou acc\xE9l\xE9rer"],
      ["Espace", "Sauter \xE0 pied, freiner en v\xE9hicule"],
    ];
    let S = null,
      x = null,
      c = "",
      P = !1;
    function C() {
      return [...A.querySelectorAll('[role="dialog"]')].some((ve) => ve !== h && !ve.hidden);
    }
    function Ne() {
      if (!R.enabled || R.getVehicleState().riding || A.dataset.ui22SettingsOpen === "true" || C()) return null;
      let ve = null;
      for (const qe of pe) {
        (qe.object.updateWorldMatrix(!0, !1), qe.object.getWorldPosition(X));
        const Xe = R.position.x - X.x,
          _t = R.position.z - X.z,
          Mt = Math.hypot(Xe, _t);
        (a.set(0, 0, 1).transformDirection(qe.object.matrixWorld),
          !(Mt > 4.6 || Xe * a.x + _t * a.z < -0.3) && (!ve || Mt < ve.distance) && (ve = { ...qe, distance: Mt }));
      }
      return ve;
    }
    function z() {
      const ve = Ne();
      if (!ve || !h.hidden) return !1;
      ((S = ve), (x = T.activeElement), (h.querySelector("h2").textContent = ve.title));
      const qe = h.querySelector("[data-sign25-content]");
      if ((qe.replaceChildren(), ve.guide)) {
        const Xe = T.createElement("dl");
        for (const [Mt, st] of p) {
          const $ = T.createElement("dt"),
            U = T.createElement("dd");
          (($.textContent = Mt), (U.textContent = st), Xe.append($, U));
        }
        qe.append(Xe);
        const _t = T.createElement("p");
        ((_t.className = "sign25-note"),
          (_t.textContent = "Un secret vous attend au-del\xE0 du vieux pont. Cherchez le sceau du Cygne\u2026"),
          qe.append(_t));
      } else {
        const Xe = T.createElement("p");
        ((Xe.className = "sign25-place"), (Xe.textContent = "MOULIN DE SAINT CHRISTOPHE"));
        const _t = T.createElement("p");
        ((_t.className = "sign25-crokmou"), (_t.textContent = "\u2190 CROKMOULAND"));
        const Mt = T.createElement("p");
        ((Mt.className = "sign25-note"),
          (Mt.textContent =
            "Bienvenue au domaine. Le panneau suivant vous explique les commandes pour explorer les jardins."),
          qe.append(Xe, _t, Mt));
      }
      return ((h.hidden = !1), R.resetInput(), (v.hidden = k.hidden = !0), h.querySelector("button").focus(), !0);
    }
    function ce() {
      ((h.hidden = !0), R.resetInput(), x != null && x.isConnected && x.focus({ preventScroll: !0 }));
    }
    (h.querySelector("button").addEventListener("click", ce),
      k.addEventListener("click", z),
      v.addEventListener("click", () => {
        R.getVehicleState().riding ? R.dismountVehicle() : R.mountVehicle();
      }));
    const V = (ve) => {
      var qe;
      return (qe = ve.target) == null ? void 0 : qe.closest('input,textarea,select,[contenteditable="true"]');
    };
    function Me(ve) {
      if (!h.hidden) {
        (ve.preventDefault(),
          ve.stopImmediatePropagation(),
          ["Escape", "Enter", " "].includes(ve.key) ? ce() : ve.key === "Tab" && h.querySelector("button").focus());
        return;
      }
      !R.enabled ||
        ve.repeat ||
        ve.ctrlKey ||
        ve.metaKey ||
        ve.altKey ||
        V(ve) ||
        ve.key.toLowerCase() !== "l" ||
        C() ||
        (z() && (ve.preventDefault(), ve.stopImmediatePropagation()));
    }
    T.addEventListener("keydown", Me, !0);
    function je(ve, qe) {
      le.copy(qe).project(te);
      const Xe = O.domElement.getBoundingClientRect(),
        _t = A.getBoundingClientRect();
      if (le.z < -1 || le.z > 1 || Math.abs(le.x) > 1 || Math.abs(le.y) > 1) {
        ve.hidden = !0;
        return;
      }
      const Mt = (le.x * 0.5 + 0.5) * Xe.width + Xe.left - _t.left,
        st = (-le.y * 0.5 + 0.5) * Xe.height + Xe.top - _t.top;
      ((ve.hidden = !1), (ve.style.left = Mt.toFixed(1) + "px"), (ve.style.top = st.toFixed(1) + "px"));
    }
    function lt() {
      var Xe;
      if (P) return !1;
      if (
        ((b.hidden = !0),
        !h.hidden && !R.enabled && ce(),
        !R.enabled || !h.hidden || C() || A.dataset.ui22SettingsOpen === "true")
      )
        return ((v.hidden = k.hidden = !0), !1);
      ((S = Ne()), S ? (S.object.localToWorld(X.set(0, 2.78, 0)), je(k, X)) : (k.hidden = !0));
      const ve = R.getVehicleState(),
        qe = ve.nearbyId;
      if (ve.riding)
        return (
          (v.hidden = !0),
          (b.hidden = !1),
          (b.disabled = Math.abs(ve.speed) > 0.35),
          (b.title = b.disabled ? "Ralentir pour descendre" : "Descendre du v\xE9hicule"),
          !1
        );
      if (qe) {
        const _t = ve.riding
          ? { x: R.position.x, z: R.position.z, type: ve.type }
          : he.get(qe) || ((Xe = R.exportParking24) == null ? void 0 : Xe.call(R).find((Mt) => Mt.id === qe));
        if (_t) {
          const Mt = ve.type === "car" || String(qe).startsWith("voiture-"),
            st = ve.riding ? R.position.y : R.surface(_t.x, _t.z);
          (le.set(_t.x, st + (Mt ? 2.15 : 1.6), _t.z), je(v, le));
          const $ = ve.riding ? "Descendre du v\xE9hicule" : "Monter " + (Mt ? "dans la voiture" : "sur le quad");
          $ !== c && ((c = $), v.setAttribute("aria-label", $), (v.title = $));
        } else v.hidden = !0;
      } else v.hidden = !0;
      return !1;
    }
    return {
      update: lt,
      showSign: z,
      closeSign: ce,
      vehiclePrompt: v,
      signPrompt: k,
      panel: h,
      exitButton: b,
      getState: () => ({
        reading: !h.hidden,
        nearSign: (S == null ? void 0 : S.object.name) || null,
        vehiclePrompt: !v.hidden,
        signPrompt: !k.hidden,
      }),
      dispose() {
        ((P = !0), T.removeEventListener("keydown", Me, !0), v.remove(), k.remove(), h.remove(), b.remove());
      },
    };
  }),
  (globalThis.MoulinAdventure24 = function (t, n) {
    "use strict";
    const { root: A, model: re, player: R, editor: he, terrainHeight: te, markDirty: O } = n,
      T = A.ownerDocument,
      le = { x: -97.8457, z: 116.3729 },
      X = t.MathUtils.clamp,
      a = new t.Group();
    ((a.name = "Aventure_de_l_Ordre_du_Cygne"), re.add(a));
    const _e = new t.MeshStandardMaterial({ color: 5913893, roughness: 1, polygonOffset: !0, polygonOffsetFactor: -2 }),
      pe = new t.MeshStandardMaterial({ color: 8413254, roughness: 1 }),
      q = new t.MeshStandardMaterial({ color: 5847843, roughness: 0.85 }),
      v = new t.MeshStandardMaterial({ color: 9265716, roughness: 0.9 }),
      k = new t.MeshStandardMaterial({ color: 2370349, metalness: 0.72, roughness: 0.41 }),
      h = new t.MeshStandardMaterial({ color: 13210434, metalness: 0.74, roughness: 0.35 }),
      b = new t.MeshStandardMaterial({ color: 8885647, metalness: 0.75, roughness: 0.35 }),
      p = new t.Vector3(0, 1, 0),
      S = new t.Vector3(),
      x = new t.Matrix4(),
      c = new t.Quaternion();
    function P(de, oe, y, I, Be) {
      const Se = new t.Mesh(new t.BoxGeometry(...y), Be);
      return ((Se.name = oe), Se.position.set(...I), (Se.castShadow = Se.receiveShadow = !0), de.add(Se), Se);
    }
    const C = new t.Group();
    ((C.name = "Pelle_du_promeneur"),
      (C.visible = !1),
      R.actor.add(C),
      P(C, "Manche_en_frene", [0.044, 0.88, 0.044], [0, 0.64, 0], v));
    const Ne = new t.Mesh(new t.TorusGeometry(0.094, 0.019, 6, 16, Math.PI * 1.65), k);
    (Ne.position.set(0, 1.17, 0),
      (Ne.rotation.z = -Math.PI * 0.325),
      C.add(Ne),
      P(C, "Traverse_poignee", [0.17, 0.03, 0.036], [0, 1.12, 0], k));
    const z = new t.Shape();
    (z.moveTo(-0.12, 0.33),
      z.lineTo(0.12, 0.33),
      z.lineTo(0.155, 0.1),
      z.quadraticCurveTo(0.12, -0.03, 0, -0.08),
      z.quadraticCurveTo(-0.12, -0.03, -0.155, 0.1),
      z.closePath());
    const ce = new t.Mesh(
      new t.ExtrudeGeometry(z, {
        depth: 0.024,
        bevelEnabled: !0,
        bevelSize: 0.012,
        bevelThickness: 0.008,
        bevelSegments: 1,
        steps: 1,
      }),
      b,
    );
    ((ce.name = "Fer_courbe_de_pelle"), (ce.rotation.x = 0.13), (ce.castShadow = !0), C.add(ce));
    const V = new t.Vector3(),
      Me = new t.Vector3(),
      je = new t.Group();
    ((je.name = "Marque_du_tresor_pres_du_pont"), a.add(je), je.position.set(le.x, te(le.x, le.z) + 0.04, le.z));
    for (const de of [-Math.PI / 4, Math.PI / 4]) {
      const oe = P(je, "Croix_doree_sol_remue", [1.22, 0.055, 0.14], [0, 0.035, 0], h);
      oe.rotation.y = de;
    }
    const lt = new t.Group();
    ((lt.name = "Panneau_du_secret_du_Cygne"),
      lt.position.set(1.13, 0, -0.72),
      (lt.rotation.y = -0.45),
      je.add(lt),
      P(lt, "Poteau_en_chene", [0.12, 1.94, 0.12], [0, 0.97, 0], v),
      P(lt, "Panneau_en_chene", [1.27, 0.89, 0.1], [0, 1.64, 0], q));
    for (const de of [-0.64, 0.64]) P(lt, "Bordure_doree_verticale", [0.045, 0.96, 0.14], [de, 1.64, 0], h);
    for (const de of [1.18, 2.1]) P(lt, "Bordure_doree_horizontale", [1.32, 0.045, 0.14], [0, de, 0], h);
    const Ke = T.createElement("canvas");
    ((Ke.width = 768), (Ke.height = 512));
    const ve = Ke.getContext("2d");
    ((ve.fillStyle = "#392a1c"), ve.fillRect(0, 0, 768, 512));
    for (let de = 0; de < 42; de++)
      ((ve.fillStyle = de % 3 ? "#433120" : "#4d3823"), ve.fillRect(0, de * 12 + (de % 3), 768, 1 + (de % 2)));
    ((ve.textAlign = "center"),
      (ve.fillStyle = "#f6deb0"),
      (ve.font = "600 39px Georgia,serif"),
      ve.fillText("ICI REPOSE", 384, 155),
      (ve.font = "700 69px Georgia,serif"),
      (ve.fillStyle = "#ffe4a1"),
      ve.fillText("UN SECRET", 384, 247),
      (ve.fillStyle = "#d4b987"),
      ve.fillRect(151, 286, 466, 2),
      (ve.font = "600 29px sans-serif"),
      ve.fillText("CREUSEZ SUR LA CROIX", 384, 351),
      (ve.font = "700 34px sans-serif"),
      (ve.fillStyle = "#ffe4a1"),
      ve.fillText("R  \xB7  CREUSER", 384, 429));
    const qe = new t.CanvasTexture(Ke);
    ((qe.encoding = t.sRGBEncoding), (qe.anisotropy = 4));
    const Xe = new t.MeshStandardMaterial({ map: qe, roughness: 0.92, emissive: 4797206, emissiveIntensity: 0.18 });
    for (const de of [-1, 1]) {
      const oe = new t.Mesh(new t.PlaneGeometry(1.24, 0.84), Xe);
      ((oe.name = "Inscription_du_secret_lisible"),
        oe.position.set(0, 1.64, de * 0.056),
        (oe.rotation.y = de < 0 ? Math.PI : 0),
        lt.add(oe));
    }
    const _t = globalThis.MoulinHost30.swan || "",
      Mt = _t ? new t.TextureLoader().load(_t, () => (O == null ? void 0 : O())) : null;
    Mt && (Mt.encoding = t.sRGBEncoding);
    const st = new t.MeshBasicMaterial({
        map: Mt,
        transparent: !0,
        alphaTest: 0.03,
        side: t.DoubleSide,
        depthWrite: !1,
      }),
      $ = new t.Mesh(new t.CylinderGeometry(0.19, 0.19, 0.075, 20), h);
    (($.name = "Medaille_du_Cygne"), ($.rotation.x = Math.PI / 2), $.position.set(0, 2.27, 0), lt.add($));
    for (const de of [-1, 1]) {
      const oe = new t.Mesh(new t.PlaneGeometry(0.32, 0.213), st);
      ((oe.name = "Embleme_du_cygne_sur_le_piquet"),
        oe.position.set(0, 2.27, de * 0.041),
        (oe.rotation.y = de < 0 ? Math.PI : 0),
        lt.add(oe));
    }
    const U = new t.Group();
    ((U.name = "Coffre_de_l_Ordre_du_Cygne"),
      U.position.set(le.x, te(le.x, le.z) - 0.35, le.z),
      (U.rotation.y = -Math.PI / 4),
      (U.visible = !1),
      a.add(U),
      P(U, "Fond_du_coffre", [1.08, 0.09, 0.75], [0, 0.045, 0], q));
    for (let de = 0; de < 4; de++) {
      for (const oe of [-0.35, 0.35])
        P(U, "Planche_du_coffre", [1.08, 0.103, 0.055], [0, 0.12 + de * 0.108, oe], de % 2 ? q : v);
      for (const oe of [-0.525, 0.525]) P(U, "Joue_du_coffre", [0.055, 0.103, 0.7], [oe, 0.12 + de * 0.108, 0], q);
    }
    for (const de of [-0.36, 0.36]) {
      for (const oe of [-0.39, 0.39]) P(U, "Ferrure_verticale", [0.06, 0.48, 0.028], [de, 0.27, oe], k);
      P(U, "Ferrure_sous_coffre", [0.06, 0.025, 0.82], [de, 0.018, 0], k);
    }
    for (const de of [-0.36, 0.36])
      for (const oe of [0.1, 0.22, 0.36, 0.48]) {
        const y = new t.Mesh(new t.SphereGeometry(0.023, 6, 4), h);
        (y.position.set(de, oe, 0.41), U.add(y));
      }
    P(U, "Serrure_doree", [0.12, 0.16, 0.035], [0, 0.41, 0.4], h);
    const He = new t.Group();
    ((He.name = "Couvercle_ouvrant"), He.position.set(0, 0.53, -0.36), U.add(He));
    for (let de = 0; de < 13; de++) {
      const oe = (de / 12) * Math.PI,
        y = P(
          He,
          "Latte_du_couvercle",
          [1.1, 0.054, 0.101],
          [0, 0.37 * Math.sin(oe), 0.36 + 0.36 * Math.cos(oe)],
          de % 2 ? q : v,
        );
      y.rotation.x = oe - Math.PI / 2;
    }
    for (const de of [-1, 1]) {
      const oe = [de * 0.549, 0, 0.36],
        y = [];
      for (let Se = 0; Se <= 16; Se++) {
        const N = (Se / 16) * Math.PI;
        (oe.push(de * 0.549, 0.37 * Math.sin(N), 0.36 + 0.36 * Math.cos(N)),
          Se && y.push(...(de > 0 ? [0, Se + 1, Se] : [0, Se, Se + 1])));
      }
      const I = new t.BufferGeometry();
      (I.setAttribute("position", new t.Float32BufferAttribute(oe, 3)), I.setIndex(y), I.computeVertexNormals());
      const Be = new t.Mesh(I, q);
      ((Be.name = "Joue_fermee_du_couvercle"), (Be.castShadow = !0), He.add(Be));
    }
    for (const de of [-0.36, 0.36]) {
      const oe = new t.Mesh(new t.TorusGeometry(0.385, 0.027, 5, 24, Math.PI), k);
      ((oe.rotation.y = Math.PI / 2), oe.position.set(de, 0, 0.36), He.add(oe));
    }
    const Ce = new t.Mesh(new t.PlaneGeometry(0.56, 0.373), st);
    ((Ce.name = "Cygne_du_coffre"), Ce.position.set(0, 0.43, 0.385), U.add(Ce));
    const xe = new t.MeshStandardMaterial({ color: 15456170, roughness: 1 });
    for (const de of [-0.23, 0.1]) {
      const oe = new t.Mesh(new t.CylinderGeometry(0.065, 0.065, 0.43, 12), xe);
      ((oe.rotation.z = Math.PI / 2), oe.position.set(de, 0.29, 0.08), U.add(oe));
    }
    for (let de = 0; de < 17; de++) {
      const oe = new t.Mesh(new t.CylinderGeometry(0.053, 0.053, 0.018, 8), h);
      (oe.position.set(Math.sin(de * 2.4) * 0.34, 0.13 + (de % 3) * 0.025, Math.cos(de * 1.8) * 0.21),
        (oe.rotation.z = Math.sin(de) * 0.15),
        U.add(oe));
    }
    const H = new t.PointLight(16766087, 0, 4, 2);
    (H.position.set(0, 0.75, 0), U.add(H));
    const W = new t.Group();
    ((W.name = "Terre_excavee"), a.add(W));
    let D = "",
      De = -1,
      ke = 0,
      rt = !1;
    const $e = new t.IcosahedronGeometry(0.052, 0),
      B = new t.InstancedMesh($e, pe, 24);
    ((B.name = "Mottes_projetees"), (B.count = 0), (B.frustumCulled = !1), (B.userData.exportSkip = !0), a.add(B));
    let F = 99,
      g = new t.Vector3(),
      G = !1,
      Qe = 0,
      Fe = !1,
      Le = null,
      pt = 0,
      Ge = null;
    const m = T.createElement("button");
    ((m.type = "button"),
      (m.className = "player24-dig"),
      m.setAttribute("aria-label", "Creuser devant le personnage"),
      (m.title = "Creuser"),
      (m.innerHTML =
        '<svg viewBox="0 0 32 32" aria-hidden="true"><g transform="rotate(38 16 16)"><path d="M12 3h8v3a4 4 0 0 1-8 0Z"/><path d="M16 10v9"/><path d="M10 18h12v6c0 3.6-6 6-6 6s-6-2.4-6-6Z" fill="currentColor" fill-opacity=".2"/><path d="M16 21v5"/></g></svg>'));
    const at = A.querySelector(".player19-actions") || A.querySelector(".player19-hud");
    at == null || at.appendChild(m);
    const ft = T.createElement("button");
    ((ft.type = "button"),
      (ft.className = "player27-open-chest"),
      (ft.dataset.openTreasure27 = ""),
      (ft.hidden = !0),
      (ft.innerHTML = "<kbd>O</kbd><span>Ouvrir le coffre</span>"),
      ft.setAttribute("aria-keyshortcuts", "O"),
      ft.setAttribute("aria-label", "Ouvrir le coffre (O)"),
      at == null || at.appendChild(ft));
    const ue = T.createElement("section");
    ((ue.className = "adventure24-award"),
      (ue.hidden = !0),
      ue.setAttribute("role", "dialog"),
      ue.setAttribute("aria-modal", "true"),
      ue.setAttribute("aria-labelledby", "adventure24-title"),
      (ue.innerHTML = `<div class="adventure24-parchment"><p class="adventure24-eyebrow">Le secret du vieux pont</p><img class="adventure24-swan" alt="Cygne cuivr\xE9 de l\u2019Ordre" width="158" height="106"><h2 id="adventure24-title">F\xE9licitations, aventurier !</h2><p class="adventure24-message">Vous faites d\xE9sormais partie de L'ordre du Cygne du moulin de Saint Christophe</p><button class="btn" type="button">Allez demander votre r\xE9compense \xE0 votre h\xF4te</button></div>`),
      (ue.querySelector("img").src = _t),
      A.appendChild(ue));
    function se(de) {
      var oe;
      (oe = n.announce) == null || oe.call(n, de);
    }
    function Ve() {
      return he.getAdventure24(!1).opened27
        ? ((Ge = T.activeElement),
          (ue.hidden = !1),
          (ft.hidden = m.hidden = !0),
          R.resetInput(),
          ue.querySelector("button").focus(),
          O == null || O(),
          !0)
        : !1;
    }
    function vt() {
      ((rt = !1),
        (ue.hidden = !0),
        R.resetInput(),
        Ge != null && Ge.isConnected && !Ge.hidden && Ge.focus({ preventScroll: !0 }));
    }
    function me() {
      return (
        A.dataset.ui22SettingsOpen === "true" ||
        [...A.querySelectorAll('[role="dialog"]')].some((de) => de !== ue && !de.hidden)
      );
    }
    function Re() {
      return he.getAdventure24(!1).treasure >= 3 && Math.hypot(R.position.x - le.x, R.position.z - le.z) < 2.7;
    }
    function et() {
      const de = R.getAudioState();
      return !R.enabled || de.vehicle || de.grounded === !1 || de.speed > 0.8 || G || rt || !ue.hidden || me() || !Re()
        ? !1
        : (R.resetInput(),
          he.getAdventure24(!1).opened27
            ? Ve()
            : he.openTreasure27()
              ? ((rt = !0), (ft.disabled = !0), se("Le sceau du Cygne se soul\xE8ve\u2026"), O == null || O(), !0)
              : !1);
    }
    (ft.addEventListener("click", et), ue.querySelector("button").addEventListener("click", vt));
    function kt(de) {
      var y;
      const oe =
        de.treasure + "|" + de.opened27 + "|" + de.holes.map((I) => [I.x, I.z, I.depth, I.seed].join(",")).join(";");
      if (oe !== D) {
        D = oe;
        for (const I of W.children.slice()) ((y = I.geometry) == null || y.dispose(), W.remove(I));
        for (const I of de.holes) {
          const Be = new t.PlaneGeometry(2.45, 2.45, 12, 12);
          Be.rotateX(-Math.PI / 2);
          const Se = Be.attributes.position;
          for (let w = 0; w < Se.count; w++) {
            const be = Se.getX(w),
              ne = Se.getZ(w),
              K = Math.hypot(be, ne),
              fe = 1.02 + 0.07 * Math.sin(Math.atan2(ne, be) * 7 + I.seed);
            if (K > fe) {
              const mt = fe / K;
              (Se.setX(w, be * mt), Se.setZ(w, ne * mt));
            }
            const Ee = I.x + Se.getX(w),
              bt = I.z + Se.getZ(w);
            Se.setY(w, te(Ee, bt) + 0.018);
          }
          Be.computeVertexNormals();
          const N = new t.Mesh(Be, _e);
          ((N.name = "Creux_de_terre"), N.position.set(I.x, 0, I.z), (N.receiveShadow = !0), W.add(N));
          const Ie = new t.TorusGeometry(1.12, 0.06 + Math.min(0.08, I.depth * 0.1), 5, 28);
          Ie.rotateX(Math.PI / 2);
          const E = Ie.attributes.position;
          for (let w = 0; w < E.count; w++) E.setY(w, E.getY(w) + te(I.x + E.getX(w), I.z + E.getZ(w)) + 0.01);
          Ie.computeVertexNormals();
          const Y = new t.Mesh(Ie, pe);
          (Y.position.set(I.x, 0, I.z), (Y.receiveShadow = !0), W.add(Y));
        }
        ((U.position.y = te(le.x, le.z) + 0.06),
          (je.position.y = te(le.x, le.z) + 0.055),
          (lt.position.y = te(le.x + 1.13, le.z - 0.72) - te(le.x, le.z)),
          (U.visible = de.treasure >= 3),
          (je.visible = de.treasure < 3),
          de.opened27
            ? De < 0 && ((ke = 1), (He.rotation.x = -1.6))
            : ((ke = 0), (He.rotation.x = 0), (ue.hidden = !0), (rt = !1)),
          (De = de.treasure),
          O == null || O());
      }
    }
    function M() {
      const de = R.getAudioState();
      if (!ue.hidden || !R.enabled || de.vehicle || G || rt || me()) return !1;
      if (de.grounded === !1 || de.speed > 0.8) return (se("Arr\xEAte-toi sur le sol pour creuser."), !1);
      const oe = R.position,
        y = Math.hypot(oe.x - le.x, oe.z - le.z),
        I = he.getAdventure24(!1);
      if (I.treasure >= 3 && y < 2.7)
        return (
          se(
            I.opened27
              ? "Le message du Cygne est dans le coffre."
              : "Le coffre est ferm\xE9. Appuie sur O pour l\u2019ouvrir.",
          ),
          !1
        );
      const Be = de.heading || 0;
      let Se = oe.x + Math.sin(Be) * 1.08,
        N = oe.z + Math.cos(Be) * 1.08;
      const Ie = y < 2.3 && Math.hypot(Se - le.x, N - le.z) < 1.45;
      Ie && ((Se = le.x), (N = le.z));
      const E = R.surfaceInfo(Se, N);
      if (!he.terrainAllowed(Se, N) || E.type === "bridge" || E.type === "approach" || n.wetAt([Se, N], 0.7))
        return (se("Cherche de la terre libre, loin des murs et de l\u2019eau."), !1);
      const Y = I.holes.find((w) => Math.hypot(w.x - Se, w.z - N) < 0.9);
      return Y && Y.depth >= 0.82
        ? (se("Le trou est assez profond ici."), !1)
        : ((Le = { x: Se, z: N, near: Ie, start: oe.clone() }),
          (G = !0),
          (Qe = 0),
          (Fe = !1),
          (C.visible = !0),
          m.classList.add("is-held"),
          R.resetInput(),
          O == null || O(),
          !0);
    }
    function ee() {
      ((G = !1), (C.visible = !1), m.classList.remove("is-held"));
    }
    m.addEventListener("click", () => M());
    function ge(de) {
      var y;
      if (!ue.hidden) {
        de.key === "Escape" || de.key === "Enter" || de.key === " "
          ? (de.preventDefault(), de.stopImmediatePropagation(), vt())
          : de.key === "Tab"
            ? (de.preventDefault(), de.stopImmediatePropagation(), ue.querySelector("button").focus())
            : (de.preventDefault(), de.stopImmediatePropagation());
        return;
      }
      if (
        de.ctrlKey ||
        de.metaKey ||
        de.altKey ||
        ((y = de.target) != null && y.closest('input,textarea,select,[contenteditable="true"]')) ||
        !R.enabled ||
        me()
      )
        return;
      const oe = de.key.toLowerCase();
      (oe !== "r" && oe !== "o") ||
        (oe === "o" && !Re()) ||
        (de.preventDefault(), de.stopImmediatePropagation(), de.repeat || (oe === "o" ? et() : M()));
    }
    T.addEventListener("keydown", ge, !0);
    function ae(de = 0.033) {
      var Y, w;
      pt += de;
      const oe = he.tickDigHoles25(de),
        y = he.getAdventure24(!1);
      kt(y);
      const I = R.getAudioState(),
        Be = Re(),
        Se = R.enabled && !I.vehicle && !me() && ue.hidden;
      ((m.hidden = !Se || Be), (ft.hidden = !Se || !Be), (ft.disabled = G || rt || I.grounded === !1 || I.speed > 0.8));
      const N = y.opened27 ? "Relire le message" : "Ouvrir le coffre";
      (ft.querySelector("span").textContent !== N &&
        ((ft.querySelector("span").textContent = N), ft.setAttribute("aria-label", N + " (O)")),
        (!R.enabled || I.vehicle) && (ue.hidden || vt(), (rt = !1)));
      const Ie = te(le.x, le.z);
      let E = oe || Math.abs(U.position.y - Ie - 0.06) > 1e-4;
      if (((U.position.y = Ie + 0.06), (je.position.y = Ie + 0.055), U.visible)) {
        const be = ke;
        ((ke = y.opened27 ? Math.min(1, ke + de * 1.6) : 0),
          (He.rotation.x = -ke * 1.6),
          (H.intensity = y.opened27 ? 0.32 + 0.04 * Math.sin(pt * 2) : 0.08),
          (E = E || be !== ke),
          rt && ke >= 0.97 && ((rt = !1), Se && Be && Ve()));
      }
      if (G) {
        if (!R.enabled || I.vehicle || R.position.distanceTo(Le.start) > 0.55) return (ee(), !0);
        Qe += de;
        const be = X(Qe / 1.15, 0, 1),
          ne = Math.sin(Math.min(1, be / 0.53) * Math.PI * 0.5),
          K = X((be - 0.53) / 0.47, 0, 1);
        if (
          (C.position.set(0.19, 0.04 + 0.4 * (1 - ne) + 0.24 * Math.sin(K * Math.PI), 0.88 - 0.2 * (1 - ne)),
          C.rotation.set(-0.75 * (1 - ne) + 0.4 * Math.sin(K * Math.PI), 0, -0.09),
          R.actor.updateMatrixWorld(!0),
          V.set(-0.03, 0.7, 0.02),
          Me.set(0.03, 1.13, 0.01),
          C.localToWorld(V),
          C.localToWorld(Me),
          (w = (Y = R.avatar) == null ? void 0 : Y.poseDig24) == null || w.call(Y, be, V, Me),
          !Fe && Qe >= 0.56)
        ) {
          Fe = !0;
          const fe = he.digGround24(Le.x, Le.z, Le.near);
          (fe.changed
            ? ((F = 0),
              g.set(Le.x, te(Le.x, Le.z) + 0.12, Le.z),
              fe.treasure >= 3 && y.treasure < 3
                ? se("Un coffre ferm\xE9 ! Approche-toi pour l\u2019ouvrir.")
                : Le.near &&
                  se(
                    fe.treasure === 1
                      ? "Quelque chose r\xE9sonne sous la pelle\u2026"
                      : "Le couvercle appara\xEEt. Encore un effort !",
                  ))
            : se(
                fe.reason === "limit"
                  ? "Le sol se remet doucement en place. Attends quelques secondes."
                  : "Le sol ne peut pas \xEAtre creus\xE9 ici.",
              ),
            kt(he.getAdventure24(!1)));
        }
        (Qe >= 1.15 && ee(), (E = !0));
      }
      if (F < 1.1) {
        ((F += de), (B.count = 24));
        for (let be = 0; be < 24; be++) {
          const ne = be * 2.399,
            K = 0.48 + (be % 7) * 0.12,
            fe = F;
          S.set(
            g.x + Math.cos(ne) * K * fe,
            g.y + (1.3 + (be % 5) * 0.16) * fe - 2.9 * fe * fe,
            g.z + Math.sin(ne) * K * fe,
          );
          const Ee = S.y < te(S.x, S.z) ? 0 : 1 - fe / 1.2;
          (c.setFromAxisAngle(p, ne + fe * 4), x.compose(S, c, new t.Vector3(Ee, Ee, Ee)), B.setMatrixAt(be, x));
        }
        ((B.instanceMatrix.needsUpdate = !0), (E = !0));
      } else B.count && ((B.count = 0), (E = !0));
      return (E && (O == null || O()), E);
    }
    return (
      kt(he.getAdventure24(!1)),
      {
        requestDig: M,
        requestOpen: et,
        update: ae,
        showAward: Ve,
        closeAward: vt,
        getState: () => ({
          spot: { ...le },
          busy: G,
          progress: he.getAdventure24(!1).treasure,
          opened: he.getAdventure24(!1).opened27,
          openAmount: ke,
          pendingAward: rt,
          chestVisible: U.visible,
          awardVisible: !ue.hidden,
          holes: he.getAdventure24(!1).holes.length,
        }),
        group: a,
        chest: U,
        lid: He,
        marker: je,
        shovel: C,
        digButton: m,
        openButton: ft,
        award: ue,
      }
    );
  }),
  (globalThis.MoulinWeather = function (t, n) {
    const {
        scene: A,
        model: re,
        camera: R,
        renderer: he,
        hemi: te,
        sun: O,
        fill: T,
        surfaces: le,
        root: X,
        mobile: a,
        waterEffects: _e,
        bounds: pe,
        terrainHeight: q,
        markDirty: v,
      } = n,
      k = {
        sun: {
          label: "Soleil",
          cover: 0.27,
          snow: 0,
          rain: 0,
          wet: 0,
          fog: 0.0021,
          sky: "#accbdc",
          light: 2.12,
          ambient: 0.68,
        },
        clouds: {
          label: "Ciel couvert",
          cover: 0.78,
          snow: 0,
          rain: 0,
          wet: 0,
          fog: 0.0018,
          sky: "#abbac1",
          light: 0.47,
          ambient: 0.97,
        },
        rain: {
          label: "Pluie",
          cover: 0.97,
          snow: 0,
          rain: 1,
          wet: 0.92,
          fog: 0.0036,
          sky: "#85949e",
          light: 0.19,
          ambient: 0.69,
        },
        storm: {
          label: "Temp\xEAte",
          cover: 1,
          snow: 0,
          rain: 1,
          wet: 1,
          fog: 0.0052,
          sky: "#64717d",
          light: 0.11,
          ambient: 0.55,
          storm: 1,
        },
        snow: {
          label: "Neige",
          cover: 0.72,
          snow: 1,
          rain: 0,
          wet: 0.16,
          fog: 0.003,
          sky: "#c3d0d8",
          light: 0.63,
          ambient: 0.9,
        },
        // V32 : conditions supplementaires, utilisees par la meteo en direct.
        partly: {
          label: "\xC9claircies",
          cover: 0.55,
          snow: 0,
          rain: 0,
          wet: 0,
          fog: 0.002,
          sky: "#a8c3d3",
          light: 1.55,
          ambient: 0.78,
        },
        fog: {
          label: "Brouillard",
          cover: 0.9,
          snow: 0,
          rain: 0,
          wet: 0.3,
          fog: 0.017,
          sky: "#c1c8cb",
          light: 0.32,
          ambient: 1.05,
        },
        drizzle: {
          label: "Bruine",
          cover: 0.93,
          snow: 0,
          rain: 0.36,
          wet: 0.62,
          fog: 0.0045,
          sky: "#98a4aa",
          light: 0.28,
          ambient: 0.8,
        },
        showers: {
          label: "Averses",
          cover: 0.8,
          snow: 0,
          rain: 0.78,
          wet: 0.8,
          fog: 0.0032,
          sky: "#8d9ea8",
          light: 0.66,
          ambient: 0.74,
        },
        hail: {
          label: "Gr\xEAle",
          cover: 1,
          snow: 0.12,
          rain: 0.9,
          wet: 0.95,
          fog: 0.0055,
          sky: "#6b7884",
          light: 0.13,
          ambient: 0.58,
          storm: 1,
          hail: 1,
        },
      },
      h = {
        storm: { value: 0 },
        snow: { value: 0 },
        wet: { value: 0 },
        time: { value: 0 },
        cover: { value: 0.35 },
        night: { value: 0 },
        rain: { value: 0 },
        fogDensity: { value: 0 },
        fogColor: { value: new t.Color() },
        hail: { value: 0 },
        lightning: globalThis.MoulinV32.uniforms.lightning,
      },
      b = X.querySelector("[data-weather]");
    if (b && !b.querySelector("option[value=storm]")) {
      const K = document.createElement("option");
      ((K.value = "storm"), (K.textContent = "Temp\xEAte"), b.appendChild(K));
    }
    if (b)
      for (const [K, fe] of [
        ["partly", "\xC9claircies"],
        ["fog", "Brouillard"],
        ["drizzle", "Bruine"],
        ["showers", "Averses"],
        ["hail", "Gr\xEAle"],
      ])
        if (!b.querySelector("option[value=" + K + "]")) {
          const Ee = document.createElement("option");
          ((Ee.value = K), (Ee.textContent = fe), b.appendChild(Ee));
        }
    let p = "sun",
      S = !1,
      x = 0,
      c = null;
    const P = { value: new t.Vector2(0.83, 0.56) },
      C = { value: 0.2 },
      Ne = { value: a ? 0.45 : 1 };
    let z = a ? "fast" : "balanced";
    const ce = { value: new t.Vector2() },
      V = h.storm;
    let Me = 0;
    const je = {
        version: 25,
        cloudLayers: 3,
        raindrops: 0,
        splashes: 0,
        pondImpacts: 0,
        pondImpactDraws: 0,
        shelters: 0,
        quality: z,
      },
      lt = new Set();
    function Ke(K) {
      var mt, Ct;
      if (
        !K ||
        ((mt = K.userData) != null && mt.noWeatherPaint22) ||
        lt.has(K) ||
        (!K.isMeshStandardMaterial && !K.isMeshLambertMaterial) ||
        K.transparent ||
        K.name === "weather"
      )
        return;
      lt.add(K);
      const fe = K.onBeforeCompile,
        Ee = (Ct = K.customProgramCacheKey) == null ? void 0 : Ct.bind(K),
        bt = Ee ? Ee() : "";
      ((K.onBeforeCompile = (Pt) => {
        (fe == null || fe(Pt),
          (Pt.uniforms.weatherSnow = h.snow),
          (Pt.uniforms.weatherWet = h.wet),
          (Pt.uniforms.weatherRoof = { value: K.map === le.slate ? 1 : 0 }),
          (Pt.vertexShader =
            `varying vec3 weatherWorld;varying vec3 weatherNormal;
` + Pt.vertexShader),
          (Pt.vertexShader = Pt.vertexShader.replace(
            "#include <project_vertex>",
            `#include <project_vertex>
    vec4 weatherPosition=vec4(transformed,1.0);
    #ifdef USE_INSTANCING
     weatherPosition=instanceMatrix*weatherPosition;
    #endif
    weatherWorld=(modelMatrix*weatherPosition).xyz;
    weatherNormal=inverseTransformDirection(transformedNormal,viewMatrix);`,
          )),
          (Pt.fragmentShader =
            `uniform float weatherSnow;uniform float weatherWet;uniform float weatherRoof;varying vec3 weatherWorld;varying vec3 weatherNormal;
` + Pt.fragmentShader),
          (Pt.fragmentShader = Pt.fragmentShader.replace(
            "#include <color_fragment>",
            `#include <color_fragment>
    float snowMask=0.0;
    float waterFilm=weatherWet*smoothstep(-.1,.72,normalize(weatherNormal).y);
    float wetGrain=.78+.22*sin(weatherWorld.x*.63+sin(weatherWorld.z*.9))*sin(weatherWorld.z*.81);
    if(weatherWet>.001)diffuseColor.rgb*=1.0-weatherWet*(.13+waterFilm*.13);
    if(weatherSnow>.001){
     float snowGrain=.93+.07*sin(weatherWorld.x*41.0+sin(weatherWorld.z*39.0))*sin(weatherWorld.z*43.0);
     float ny=normalize(weatherNormal).y,upward=smoothstep(.12,.68,mix(ny,abs(ny),weatherRoof));snowMask=weatherSnow*upward;
     diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.82,.90,.96)*snowGrain,snowMask);
    }`,
          )),
          K.isMeshStandardMaterial &&
            (Pt.fragmentShader = Pt.fragmentShader.replace(
              "#include <roughnessmap_fragment>",
              `#include <roughnessmap_fragment>
    roughnessFactor=mix(roughnessFactor,max(.14,roughnessFactor*.43),weatherWet*(.40+.60*waterFilm*wetGrain)*(1.0-snowMask));
    roughnessFactor=mix(roughnessFactor,.93,snowMask);`,
            )));
      }),
        (K.customProgramCacheKey = () => bt + "|moulin-weather-v24"),
        (K.needsUpdate = !0));
    }
    function ve() {
      re.traverse((K) => {
        if (!K.userData.isWater) for (const fe of Array.isArray(K.material) ? K.material : [K.material]) Ke(fe);
      });
    }
    ve();
    const qe = new t.Group();
    ((qe.name = "Meteo"), (qe.userData.exportSkip = !0), A.add(qe));
    const Xe = 256,
      _t = new Uint8Array(Xe * Xe * 4);
    for (let K = 0; K < Xe; K++)
      for (let fe = 0; fe < Xe; fe++) {
        const Ee = le.noise(fe * 0.11, K * 0.11),
          bt = (K * Xe + fe) * 4;
        ((_t[bt] = _t[bt + 1] = _t[bt + 2] = Math.round(Ee * 255)), (_t[bt + 3] = 255));
      }
    const Mt = le.fromData(_t, Xe, !1, !0),
      st = new t.ShaderMaterial({
        side: t.BackSide,
        depthWrite: !1,
        uniforms: {
          noiseMap: { value: Mt },
          weatherTime: h.time,
          cover: h.cover,
          night: h.night,
          rain: h.rain,
          snow: h.snow,
          wind24: P,
          windStrength24: C,
          skyDetail24: Ne,
          cloudAdvection25: ce,
          storm25: V,
          sunDirection24: { value: new t.Vector3(-65, 98, 62).normalize() },
          moonDirection32: globalThis.MoulinV32.uniforms.moonDirection,
          moonLight32: globalThis.MoulinV32.uniforms.moonLight,
          lightning32: globalThis.MoulinV32.uniforms.lightning,
        },
        vertexShader:
          "varying vec3 skyWorld;void main(){vec4 world=modelMatrix*vec4(position,1.0);skyWorld=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}",
        fragmentShader: `
  uniform sampler2D noiseMap;uniform float weatherTime,cover,night,rain,snow,windStrength24,skyDetail24,storm25;uniform vec2 wind24,cloudAdvection25;uniform vec3 sunDirection24,moonDirection32;uniform vec2 moonLight32;uniform float lightning32;varying vec3 skyWorld;
  float cloudNoise(vec2 p){return texture2D(noiseMap,p).r*.54+texture2D(noiseMap,p*2.03+.13).r*.28+texture2D(noiseMap,p*4.07-.19).r*.18;}
  void main(){
   vec3 ray=normalize(skyWorld-cameraPosition);float h=clamp(ray.y,0.,1.),haze=exp(-h*6.2);float overcast=smoothstep(.42,.92,cover);
   vec3 horizon=vec3(.52,.66,.74),zenith=vec3(.075,.28,.51);
   vec3 day=mix(zenith,horizon,haze);day=mix(day,mix(vec3(.36,.43,.49),vec3(.54,.61,.65),haze),overcast*.66);
   day=mix(day,vec3(.37,.44,.50),rain*.31);day=mix(day,mix(vec3(.42,.53,.62),vec3(.66,.72,.77),haze),snow*.5);
   float angle=max(dot(ray,sunDirection24),0.);vec3 warm=vec3(1.,.83,.58);
   day+=warm*(pow(angle,18.)*.075+pow(angle,120.)*.08)*(1.-overcast*.94);
   // V32 : aube et crepuscule d'apres la hauteur reelle du soleil (sunDirection24 suit l'astre).
   float sunH32=sunDirection24.y;
   float golden32=smoothstep(-.14,.0,sunH32)*(1.-smoothstep(.05,.4,sunH32));
   float dusk32=1.-smoothstep(-.18,.03,sunH32);
   vec2 flatRay32=normalize(ray.xz+vec2(1e-4)),flatSun32=normalize(sunDirection24.xz+vec2(1e-4));
   float toward32=pow(dot(flatRay32,flatSun32)*.5+.5,2.4);
   vec3 glow32=mix(vec3(.62,.30,.42),vec3(1.,.50,.19),toward32);
   day=mix(day,glow32*(.5+.5*toward32),golden32*pow(haze,.75)*(.3+.7*toward32)*(1.-overcast*.72));
   day=mix(day,mix(vec3(.028,.05,.13),vec3(.26,.25,.42)*(.4+.6*toward32),pow(haze,.9)),dusk32*.82);
   vec3 sky=mix(day,mix(vec3(.008,.017,.033),vec3(.028,.046,.073),haze),night);
   // Lune : sphere eclairee par le vrai soleil (la phase en decoule), halo discret.
   vec3 moon32=normalize(moonDirection32);float moonAngle32=dot(ray,moon32);
   vec3 moonOffset32=ray-moon32*moonAngle32;float moonR32=.0205,moonD32=length(moonOffset32)/moonR32;
   vec3 moonNormal32=normalize(moonOffset32/moonR32-moon32*sqrt(max(0.,1.-moonD32*moonD32)));
   float moonLit32=smoothstep(-.06,.14,dot(moonNormal32,sunDirection24));
   float moonDisc32=(1.-smoothstep(.9,1.,moonD32))*step(0.,moonAngle32);
   float moonHalo32=(pow(max(moonAngle32,0.),2600.)*.22+pow(max(moonAngle32,0.),90.)*.045)*moonLight32.x;
   sky+=vec3(.86,.9,1.)*(moonDisc32*(.07+moonLit32*1.25)+moonHalo32)*night*smoothstep(-.02,.06,moon32.y);
   // A high veil crosses above a separate, lower bank of broad cumulus. Each layer
   // advects in world wind, with evolving detail rather than a single sliding sheet.
   vec2 drift=cloudAdvection25;
   vec2 uv=ray.xz/max(.085,ray.y+.035)*.067+drift;
   float n=cloudNoise(uv),fine=texture2D(noiseMap,uv*9.7+vec2(weatherTime*.00019,-weatherTime*.00011)).r;
   float threshold=.73-cover*.48;float horizonFade=smoothstep(.005,.17,ray.y);
   float density=smoothstep(threshold,threshold+.19,n+(fine-.5)*.047)*horizonFade;
   float shadeSample=cloudNoise(uv+sunDirection24.xz*.021);float edgeLight=clamp((n-shadeSample)*4.5+.55,0.,1.);
   float thickness=clamp((n-threshold)*3.2,0.,1.);vec3 cloud=mix(vec3(.38,.44,.48),vec3(.88,.91,.92),edgeLight);
   cloud*=1.-rain*(.24+thickness*.17);cloud=mix(cloud,cloud*vec3(.46,.51,.58),storm25*.72);cloud=mix(cloud,vec3(.77,.83,.87),snow*.27);
   cloud+=warm*pow(angle,18.)*pow(1.-thickness,2.)*.18*(1.-rain);
   cloud=mix(cloud,cloud*vec3(1.25,.72,.55)+vec3(.10,.03,.02)*toward32,golden32*(1.-thickness*.5)*(1.-overcast*.5));
   cloud*=mix(1.,.28,dusk32);
   cloud=mix(cloud,vec3(.055,.079,.115)*(.67+edgeLight*.4),night);sky=mix(sky,cloud,density*.95);
   vec2 lowUV=ray.xz/max(.11,ray.y+.015)*.115+drift*1.65+vec2(.37,.72);
   float low=cloudNoise(lowUV);float bank=smoothstep(.75-cover*.38,.87-cover*.34,low)*horizonFade*overcast;
   sky=mix(sky,mix(vec3(.39,.44,.48)*(1.-rain*.25),vec3(.035,.051,.077),night),bank*(.53+storm25*.27)*skyDetail24);
   vec2 highUV=ray.xz/max(.075,ray.y+.03)*vec2(.025,.12)-drift*.48;
   float veil=smoothstep(.55,.80,texture2D(noiseMap,highUV).r*.65+texture2D(noiseMap,highUV*3.2).r*.35)*horizonFade;
   sky=mix(sky,mix(vec3(.82,.88,.91),vec3(.05,.075,.11),night),veil*.19*(1.-rain)*skyDetail24);
   sky+=warm*smoothstep(.99955,.99984,angle)*(1.-density)*(1.-bank)*(1.-night)*(1.-overcast*.98)*1.9;
   // Lower hemisphere and distant haze match the terrain fog, without a hard seam.
   sky=mix(sky,mix(vec3(.49,.59,.65)*(1.-rain*.23),vec3(.025,.043,.068),night),1.-smoothstep(-.08,.055,ray.y));
   // V32 : eclair qui illumine les nuages de l'interieur.
   sky+=vec3(.62,.66,.86)*lightning32*(.18+.82*density)*smoothstep(-.05,.2,ray.y);
   gl_FragColor=vec4(sky,1.);
   #include <tonemapping_fragment>
   #include <encodings_fragment>
  }`,
      }),
      $ = new t.Mesh(new t.SphereGeometry(1050, 24, 12), st);
    (($.name = "Ciel_et_nuages"), ($.renderOrder = -1e3), ($.frustumCulled = !1), qe.add($));
    const U = 128,
      He = new Uint8Array(U * U * 4),
      Ce = le.fromData(He, U, !1, !1);
    Ce.minFilter = Ce.magFilter = t.NearestFilter;
    const xe = Array.from({ length: 24 }, () => new t.Vector4(0, 0, 0, 0)),
      H = new Float32Array(24),
      W = [];
    function D() {
      ((W.length = 0),
        re.updateWorldMatrix(!0, !0),
        re.traverse((K) => {
          if (
            !K.isMesh ||
            (!K.visible && !K.userData.renderSource) ||
            !/(Toiture_ardoise|Ardoises|Toit_abri|Toit_vitre|Auvent_entree|Toiture_carport|Toit_carport)/i.test(
              K.name,
            ) ||
            /Neige/.test(K.name)
          )
            return;
          const fe = new t.Box3().setFromObject(K);
          fe.isEmpty() || fe.max.x - fe.min.x < 0.5 || fe.max.z - fe.min.z < 0.5 || W.push(fe);
        }),
        W.sort((K, fe) => (fe.max.x - fe.min.x) * (fe.max.z - fe.min.z) - (K.max.x - K.min.x) * (K.max.z - K.min.z)),
        W.splice(24));
      for (let K = 0; K < 24; K++) {
        const fe = W[K];
        fe
          ? (xe[K].set(fe.min.x, fe.max.x, fe.min.z, fe.max.z), (H[K] = fe.max.y))
          : (xe[K].set(0, 0, 0, 0), (H[K] = -1e3));
      }
      je.shelters = W.length;
    }
    function De() {
      for (let K = 0; K < U; K++)
        for (let fe = 0; fe < U; fe++) {
          const Ee = q(pe.x0 + (fe / (U - 1)) * (pe.x1 - pe.x0), pe.z0 + (K / (U - 1)) * (pe.z1 - pe.z0)),
            bt = (K * U + fe) * 4,
            mt = t.MathUtils.clamp(Math.round(((Ee + 12) / 64) * 65535), 0, 65535);
          ((He[bt] = mt >> 8), (He[bt + 1] = mt & 255), (He[bt + 3] = 255));
        }
      ((Ce.needsUpdate = !0), D(), (ke = -1));
    }
    let ke = -1;
    De();
    const rt = a ? 1100 : 2800,
      $e = new t.InstancedBufferGeometry(),
      B = new t.PlaneGeometry(1, 1);
    (($e.index = B.index), ($e.attributes.position = B.attributes.position), ($e.attributes.uv = B.attributes.uv));
    const F = new Float32Array(rt * 4);
    let g = 17287;
    const G = () => ((g = (Math.imul(g, 1664525) + 1013904223) >>> 0), g / 4294967296);
    for (let K = 0; K < F.length; K++) F[K] = G();
    ($e.setAttribute("dropSeed", new t.InstancedBufferAttribute(F, 4)), ($e.instanceCount = rt));
    const Qe = new t.ShaderMaterial({
        transparent: !0,
        depthWrite: !1,
        uniforms: {
          weatherTime: h.time,
          rain: h.rain,
          snow: h.snow,
          hail: h.hail,
          night: h.night,
          groundMap: { value: Ce },
          groundBounds: { value: new t.Vector4(pe.x0, pe.x1, pe.z0, pe.z1) },
          centre: { value: new t.Vector3() },
          extent: { value: 64 },
          wind24: P,
          windStrength24: C,
          shelterRects: { value: xe },
          shelterHeights: { value: H },
        },
        vertexShader: `
  attribute vec4 dropSeed;uniform float weatherTime,rain,snow,hail,extent,windStrength24;uniform vec2 wind24;uniform vec3 centre;uniform sampler2D groundMap;uniform vec4 groundBounds,shelterRects[24];uniform float shelterHeights[24];
  varying vec2 dropUv;varying float aboveGround,fade,dropShade;
  void main(){
   float fallSpeed=mix(mix(.75+dropSeed.w*1.1,17.+dropSeed.w*10.,rain),13.+dropSeed.w*6.,hail*step(.72,dropSeed.x)),column=58.;float age=mod(dropSeed.y*column-weatherTime*fallSpeed,column);
   float gust=.75+.25*sin(weatherTime*.63+dropSeed.w*6.28);vec2 drift=wind24*windStrength24*gust;
   vec3 p=vec3((dropSeed.x-.5)*extent,age,(dropSeed.z-.5)*extent);
   p.xz+=drift*(column-age)*mix(.30,.43,rain);p.xz=mod(p.xz+extent*.5,extent)-extent*.5;
   p.xz+=centre.xz+vec2(sin(weatherTime*.9+dropSeed.w*35.),cos(weatherTime*.6+dropSeed.w*27.))*snow*.75;
   p.y+=max(-10.,centre.y-20.);
   vec2 guv=(p.xz-groundBounds.xz)/(groundBounds.yw-groundBounds.xz),rainPacked25=texture2D(groundMap,guv).rg;float ground=(rainPacked25.r*65280.+rainPacked25.g*255.)/65535.*64.-12.;
   for(int i=0;i<24;i++){vec4 b=shelterRects[i];if(p.x>b.x&&p.x<b.y&&p.z>b.z&&p.z<b.w)ground=max(ground,shelterHeights[i]);}
   aboveGround=p.y-ground;vec4 viewPosition=viewMatrix*vec4(p,1.);float distanceToEye=max(0.,-viewPosition.z);
   float size=mix(.054,.016,rain)*(1.+dropSeed.w*.95);vec3 velocity=vec3(drift.x*fallSpeed*.43,-fallSpeed,drift.y*fallSpeed*.43);vec2 v=(viewMatrix*vec4(velocity,0.)).xy;vec2 axis=length(v)>.001?normalize(v):vec2(0.,-1.);vec2 side=vec2(-axis.y,axis.x);
   float hailStone32=hail*step(.72,dropSeed.x);size=mix(size,.034+dropSeed.w*.03,hailStone32);
   float lengthDrop=mix(mix(size,.40+dropSeed.w*.72,rain),size*1.35,hailStone32);viewPosition.xy+=side*position.x*size+axis*position.y*lengthDrop;dropShade=mix(.72+dropSeed.w*.28,2.2,hailStone32);
   gl_Position=projectionMatrix*viewPosition;dropUv=uv;fade=smoothstep(.75,3.,distanceToEye)*(1.-smoothstep(extent*.45,extent*.82,distanceToEye));
  }`,
        fragmentShader: `
   uniform float rain,snow,night;varying vec2 dropUv;varying float aboveGround,fade,dropShade;
   void main(){if(aboveGround<.05)discard;vec2 q=dropUv-.5;float flake=1.-smoothstep(.09,.5,length(q));float streak=(1.-smoothstep(.035,.48,abs(q.x)))*pow(max(0.,1.-abs(q.y)*2.),.7);float stone32=step(1.5,dropShade);float a=mix(mix(flake,streak,rain),1.-smoothstep(.22,.5,length(q)),stone32)*max(snow,rain)*fade*mix(.84,.62,rain)*mix(dropShade,1.1,stone32);if(a<.012)discard;gl_FragColor=vec4(mix(mix(vec3(.86,.92,.96),vec3(.95,.97,1.),stone32),vec3(.43,.57,.72),night*.65),min(a,1.));
   #include <tonemapping_fragment>
   #include <encodings_fragment>
  }`,
      }),
      Fe = new t.Mesh($e, Qe);
    ((Fe.name = "Pluie_et_flocons"), (Fe.frustumCulled = !1), (Fe.visible = !1), (Fe.renderOrder = 20), qe.add(Fe));
    const Le = a ? 96 : 240,
      pt = new t.InstancedBufferGeometry(),
      Ge = new Float32Array(Le * 4),
      m = new Float32Array(Le * 2);
    ((pt.index = B.index), (pt.attributes.position = B.attributes.position), (pt.attributes.uv = B.attributes.uv));
    for (let K = 0; K < Le; K++) ((m[K * 2] = G()), (m[K * 2 + 1] = G()));
    (pt.setAttribute("splashCentre", new t.InstancedBufferAttribute(Ge, 4)),
      pt.setAttribute("splashPhase", new t.InstancedBufferAttribute(m, 2)),
      (pt.instanceCount = Le));
    const at = new t.Vector3(1 / 0, 0, 0);
    function ft() {
      var K;
      (at.copy(R.position), (ke = x));
      for (let fe = 0; fe < Le; fe++) {
        const Ee = Math.sqrt((fe + 0.5) / Le) * 22,
          bt = fe * 2.399963,
          mt = R.position.x + Math.cos(bt) * Ee,
          Ct = R.position.z + Math.sin(bt) * Ee;
        let Pt = q(mt, Ct) + 0.025;
        const jt = W.some((We) => mt > We.min.x && mt < We.max.x && Ct > We.min.z && Ct < We.max.z),
          Dt = !!((K = n.wetAt) != null && K.call(n, [mt, Ct], 0.05)),
          we = mt >= pe.x0 && mt <= pe.x1 && Ct >= pe.z0 && Ct <= pe.z1;
        ((jt || !we || Dt) && (Pt = -1e3), Ge.set([mt, Pt, Ct, 0.075 + m[fe * 2 + 1] * 0.1], fe * 4));
      }
      pt.attributes.splashCentre.needsUpdate = !0;
    }
    const ue = new t.ShaderMaterial({
        transparent: !0,
        depthWrite: !1,
        side: t.DoubleSide,
        polygonOffset: !0,
        polygonOffsetFactor: -1,
        uniforms: { weatherTime: h.time, rain: h.rain, night: h.night },
        vertexShader:
          "attribute vec4 splashCentre;attribute vec2 splashPhase;uniform float weatherTime;varying vec2 splashUv;varying float splashAge;void main(){splashAge=fract(weatherTime*(1.18+splashPhase.y*.7)+splashPhase.x);float radius=splashCentre.w*(.28+splashAge*1.2);vec3 p=splashCentre.xyz+vec3(position.x*radius*2.,0.,position.y*radius*2.);gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);splashUv=uv;}",
        fragmentShader: `uniform float rain,night;varying vec2 splashUv;varying float splashAge;void main(){vec2 q=(splashUv-.5)*2.;float r=length(q),ring=(1.-smoothstep(.04,.15,abs(r-.68)))*(1.-splashAge);float core=(1.-smoothstep(.02,.2,r))*(1.-smoothstep(0.,.18,splashAge));float alpha=(ring*.26+core*.38)*rain*(1.-smoothstep(.55,1.,splashAge));if(alpha<.01)discard;gl_FragColor=vec4(mix(vec3(.63,.72,.77),vec3(.2,.30,.41),night),alpha);
 #include <tonemapping_fragment>
 #include <encodings_fragment>
 }`,
      }),
      se = new t.Mesh(pt, ue);
    ((se.name = "Impacts_de_pluie_sur_le_sol"),
      (se.frustumCulled = !1),
      (se.visible = !1),
      (se.renderOrder = 8),
      qe.add(se));
    const Ve = a ? 192 : 480,
      vt = new t.InstancedBufferGeometry(),
      me = new Float32Array(Ve * 4),
      Re = new Float32Array(Ve * 2),
      et = [];
    ((vt.index = B.index), (vt.attributes.position = B.attributes.position), (vt.attributes.uv = B.attributes.uv));
    for (let K = 0; K < Ve; K++) ((Re[K * 2] = G()), (Re[K * 2 + 1] = G()));
    (vt.setAttribute("pondCentre25", new t.InstancedBufferAttribute(me, 4)),
      vt.setAttribute("pondPhase25", new t.InstancedBufferAttribute(Re, 2)),
      (vt.instanceCount = 0));
    const kt = { weatherTime: h.time, rain: h.rain, night: h.night, wind25: C, windDirection25: P },
      M = new t.ShaderMaterial({
        uniforms: kt,
        transparent: !0,
        depthWrite: !1,
        side: t.DoubleSide,
        polygonOffset: !0,
        polygonOffsetFactor: -1,
        vertexShader: `
 attribute vec4 pondCentre25;attribute vec2 pondPhase25;uniform float weatherTime;varying vec2 pondUv25;varying float pondAge25;
 void main(){float cycle=fract(weatherTime*(.82+pondPhase25.y*.53)+pondPhase25.x);pondAge25=(cycle-.18)/.82;float radius=pondCentre25.w*(.10+max(0.,pondAge25)*.95);vec3 p=pondCentre25.xyz+vec3(position.x*radius*2.,0.,position.y*radius*2.);gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);pondUv25=uv;}`,
        fragmentShader: `
 uniform float rain,night;varying vec2 pondUv25;varying float pondAge25;
 void main(){if(pondAge25<0.)discard;float r=length((pondUv25-.5)*2.),ring=1.-smoothstep(.033,.105,abs(r-.79));float second=(1.-smoothstep(.035,.08,abs(r-.47)))*.30;float strength=(1.-smoothstep(.25,1.,pondAge25))*smoothstep(0.,.05,pondAge25);float alpha=(ring+second)*strength*rain*.73;if(alpha<.012)discard;gl_FragColor=vec4(mix(vec3(.74,.87,.91),vec3(.23,.33,.43),night),alpha);
 #include <tonemapping_fragment>
 #include <encodings_fragment>
 }`,
      }),
      ee = new t.ShaderMaterial({
        uniforms: kt,
        transparent: !0,
        depthWrite: !1,
        vertexShader: `
 attribute vec4 pondCentre25;attribute vec2 pondPhase25;uniform float weatherTime,wind25;uniform vec2 windDirection25;varying vec2 pondUv25;varying float pondCycle25;
 void main(){pondCycle25=fract(weatherTime*(.82+pondPhase25.y*.53)+pondPhase25.x);float height=max(0.,(.18-pondCycle25)*9.);vec3 p=pondCentre25.xyz+vec3(-windDirection25.x*height*wind25*.35,height,-windDirection25.y*height*wind25*.35);float splash=max(0.,1.-abs(pondCycle25-.245)/.065);p.y+=splash*.17;vec4 v=viewMatrix*vec4(p,1.);v.xy+=position.xy*vec2(.025+splash*.07,.13+splash*.05);gl_Position=projectionMatrix*v;pondUv25=uv;}`,
        fragmentShader: `
 uniform float rain,night;varying vec2 pondUv25;varying float pondCycle25;
 void main(){if(pondCycle25>.31)discard;vec2 p=(pondUv25-.5)*2.;float alpha=(1.-smoothstep(.18,1.,length(p)))*rain*.82;if(alpha<.015)discard;gl_FragColor=vec4(mix(vec3(.80,.90,.95),vec3(.31,.43,.55),night),alpha);
 #include <tonemapping_fragment>
 #include <encodings_fragment>
 }`,
      }),
      ge = new t.Mesh(vt, M),
      ae = new t.Mesh(vt, ee);
    ((ge.name = "Ronds_de_pluie_sur_les_etangs"), (ae.name = "Gouttes_et_eclaboussures_des_etangs"));
    for (const K of [ge, ae]) ((K.visible = !1), (K.frustumCulled = !1), (K.renderOrder = 12), qe.add(K));
    let de = a ? 128 : 320,
      oe = -1;
    const y = new t.Vector3(1 / 0, 0, 0),
      I =
        n.inside ||
        ((K, fe) => {
          let Ee = !1;
          for (let bt = 0, mt = fe.length - 1; bt < fe.length; mt = bt++) {
            const Ct = fe[bt],
              Pt = fe[mt];
            Ct[1] > K[1] != Pt[1] > K[1] &&
              K[0] < ((Pt[0] - Ct[0]) * (K[1] - Ct[1])) / (Pt[1] - Ct[1]) + Ct[0] &&
              (Ee = !Ee);
          }
          return Ee;
        }),
      Be = n.waterRegions || [],
      Se = n.islands || [];
    function N(K, fe, Ee = 0.44) {
      const bt = [K, fe],
        mt = Be.find((Ct) => I(bt, Ct.poly));
      if (!mt || Se.some((Ct) => I(bt, Ct))) return null;
      for (const [Ct, Pt] of [
        [Ee, 0],
        [-Ee, 0],
        [0, Ee],
        [0, -Ee],
      ])
        if (!I([K + Ct, fe + Pt], mt.poly) || Se.some((jt) => I([K + Ct, fe + Pt], jt))) return null;
      return mt;
    }
    function Ie() {
      ((oe = x), y.copy(R.position), (et.length = 0));
      const K = de * 9,
        fe = 36;
      for (let Ee = 0; Ee < K && et.length < de; Ee++) {
        const bt = Math.sqrt((Ee + 0.5) / K) * fe,
          mt = Ee * 2.399963,
          Ct = R.position.x + Math.cos(mt) * bt,
          Pt = R.position.z + Math.sin(mt) * bt,
          jt = N(Ct, Pt);
        if (!jt) continue;
        const Dt = et.length,
          we = 0.26 + Re[Dt * 2 + 1] * 0.14,
          We = jt.level + 0.024;
        (me.set([Ct, We, Pt, we], Dt * 4),
          et.push({ x: Ct, y: We, z: Pt, radius: we, pond: jt.name, level: jt.level }));
      }
      ((vt.instanceCount = et.length), (vt.attributes.pondCentre25.needsUpdate = !0));
    }
    function E() {
      const K = h.rain.value > 0.01 && R.position.y - q(R.position.x, R.position.z) < 65;
      (K && (oe < 0 || R.position.distanceToSquared(y) > 12) && x - oe > 0.28 && Ie(),
        (ge.visible = ae.visible = K && vt.instanceCount > 0));
    }
    for (const K of _e)
      ((K.waterWindDirection = P),
        (K.weatherRain = h.rain),
        (K.weatherSnow = h.snow),
        (K.weatherFog = h.fogDensity),
        (K.weatherFogColor = h.fogColor));
    function Y() {
      if (n.snowCaps) for (const Ee of n.snowCaps) Ee.visible = p === "snow";
      const K = k[p];
      A.background = new t.Color(K.sky).convertSRGBToLinear();
      const fe = new t.Color(S ? "#24394d" : K.sky).convertSRGBToLinear();
      ((A.fog = new t.FogExp2(fe, w.fog32 ?? K.fog)),
        h.fogColor.value.copy(fe),
        (h.fogDensity.value = w.fog32 ?? K.fog),
        (te.intensity = S ? 0.31 : K.ambient),
        (O.intensity = S ? 0.13 : K.light),
        (T.intensity = S ? 0.12 : p === "rain" ? 0.18 : 0.17),
        O.color.set(S ? 9349838 : p === "sun" ? 16773858 : 14018554),
        (he.toneMappingExposure = S ? 1.02 : p === "snow" ? 0.92 : 1),
        (h.night.value = S ? 1 : 0),
        (he.shadowMap.needsUpdate = !0));
    }
    function w(K, fe = !1, live32 = null) {
      if (!k[K]) return;
      p = K;
      const Ee = Object.assign({}, k[K], live32 || {});
      w.fog32 = live32 && Number.isFinite(live32.fog) ? live32.fog : null;
      if (
        ((X.querySelector("[data-weather]").value = K),
        (X.dataset.weather = K),
        (c = {
          start: performance.now(),
          from: {
            storm: h.storm.value,
            snow: h.snow.value,
            wet: h.wet.value,
            rain: h.rain.value,
            cover: h.cover.value,
            hail: h.hail.value,
          },
          to: { storm: Ee.storm || 0, snow: Ee.snow, wet: Ee.wet, rain: Ee.rain, cover: Ee.cover, hail: Ee.hail || 0 },
        }),
        fe || window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      ) {
        for (const bt of Object.keys(c.to)) h[bt].value = c.to[bt];
        c = null;
      }
      ((Fe.visible = h.rain.value > 0 || h.snow.value > 0), (se.visible = h.rain.value > 0.001), Y(), v());
    }
    function be(K, fe) {
      var jt;
      const Ee = t.MathUtils.clamp(K - Me, 0, 0.15);
      ((Me = K), (x = K), (h.time.value = K));
      let bt = !1;
      if (c) {
        const Dt = t.MathUtils.clamp((fe - c.start) / 1700, 0, 1),
          we = Dt * Dt * (3 - 2 * Dt);
        for (const We of Object.keys(c.to)) h[We].value = t.MathUtils.lerp(c.from[We], c.to[We], we);
        ((bt = !0), Dt === 1 && (c = null));
      }
      const mt = ((jt = n.getWindState) == null ? void 0 : jt.call(n)) || {
          value: 0.2,
          direction: { x: 0.83, y: 0.56 },
        },
        Ct = mt.direction || { x: 0.83, y: 0.56 };
      ((C.value = t.MathUtils.clamp(Number(mt.value ?? mt.strength) || 0, 0, 1.8)),
        P.value.set(Number(Ct.x ?? Ct[0]) || 0, Number(Ct.y ?? Ct[1]) || 0),
        P.value.lengthSq() < 0.001 && P.value.set(0.83, 0.56),
        P.value.normalize(),
        ce.value.addScaledVector(P.value, Ee * (25e-5 + C.value * 0.0038)),
        $.position.copy(R.position),
        globalThis.MoulinV32.uniforms.sunTrue.value.lengthSq() > 0.5
          ? st.uniforms.sunDirection24.value.copy(globalThis.MoulinV32.uniforms.sunTrue.value)
          : st.uniforms.sunDirection24.value.copy(O.position).sub(O.target.position).normalize());
      const Pt = (w.fog32 ?? k[p].fog) / Math.max(1, 1 + Math.max(0, R.position.y - 60) / 110);
      return (
        A.fog && (A.fog.density = Pt),
        (h.fogDensity.value = Pt),
        Qe.uniforms.centre.value.copy(R.position),
        (Qe.uniforms.extent.value = t.MathUtils.clamp(R.position.y * 0.85 + 58, 64, 240)),
        (Fe.visible = h.rain.value > 0.001 || h.snow.value > 0.001),
        (se.visible = h.rain.value > 0.001 && R.position.y - q(R.position.x, R.position.z) < 52),
        se.visible && (ke < 0 || R.position.distanceToSquared(at) > 9) && K - ke > 0.25 && ft(),
        E(),
        (je.raindrops = Fe.visible ? $e.instanceCount : 0),
        (je.splashes = se.visible ? pt.instanceCount : 0),
        (je.pondImpacts = ge.visible ? vt.instanceCount : 0),
        (je.pondImpactDraws = ge.visible ? 2 : 0),
        bt || Fe.visible || se.visible || !S
      );
    }
    function ne(K) {
      return (
        (z = a || K === "fast" ? "fast" : K === "detail" ? "detail" : "balanced"),
        ($e.instanceCount = z === "fast" ? Math.min(rt, 1e3) : z === "detail" ? rt : Math.min(rt, 2300)),
        (pt.instanceCount = z === "fast" ? Math.min(Le, 80) : z === "detail" ? Le : Math.min(Le, 180)),
        (Ne.value = z === "fast" ? 0.65 : 1),
        (de = z === "fast" ? 128 : z === "detail" ? Ve : 320),
        (oe = -1),
        (je.quality = z),
        z
      );
    }
    return (
      ne(z),
      X.querySelector("[data-weather]").addEventListener("change", (K) => w(K.target.value)),
      w("sun", !0),
      {
        set: w,
        setNight: (K) => {
          ((S = K), Y(), v());
        },
        update: be,
        updateGround: De,
        decorate: ve,
        setQuality: ne,
        particles: Fe,
        sky: $,
        splashes: se,
        pondRings: ge,
        pondDrops: ae,
        pondImpactRecords: () => et.map((K) => ({ ...K })),
        reflectionHidden: [Fe, se, ge, ae],
        uniforms: h,
        modes: k,
        stats: je,
        getState: () => ({
          ...je,
          mode: p,
          night: S,
          wind: C.value,
          windDirection: P.value.toArray(),
          rain: h.rain.value,
          snow: h.snow.value,
          cover: h.cover.value,
          storm: h.storm.value,
          cloudAdvection: ce.value.toArray(),
        }),
        get mode() {
          return p;
        },
      }
    );
  }),
  (async function () {
    "use strict";
    var t, n, A, re, R, he;
    var moulinV32 = null;
    try {
      let $ = function () {
          return ((st = (Math.imul(1664525, st) + 1013904223) >>> 0), st / 4294967296);
        },
        U = function (e, o) {
          return e + (o - e) * $();
        },
        He = function (e) {
          return [(e[0] - pe[0]) * _e, (e[1] - pe[1]) * _e];
        },
        Ce = function (e, o = 0) {
          const r = He(e);
          return new a.Vector3(r[0], o, r[1]);
        },
        xe = function (e) {
          return new a.Color(e).convertSRGBToLinear();
        },
        H = function (e, o = {}) {
          return new a.MeshStandardMaterial(
            Object.assign({ color: xe(e), roughness: 0.98, flatShading: !1, envMapIntensity: 0.08 }, o),
          );
        },
        F = function (e, o, r, s = Xe) {
          const u = new a.Mesh(e, o);
          return ((u.name = r || ""), (u.castShadow = !0), (u.receiveShadow = !0), s.add(u), u);
        },
        g = function (e, o, r, s, u, _, L = Xe) {
          const Ae = F(new a.BoxGeometry(e, o, r), u, _, L);
          return (Ae.position.set(...s), Ae);
        },
        at = function (e) {
          if (!e._bounds) {
            let o = 1 / 0,
              r = -1 / 0,
              s = 1 / 0,
              u = -1 / 0;
            for (const [_, L] of e)
              ((o = Math.min(o, _)), (r = Math.max(r, _)), (s = Math.min(s, L)), (u = Math.max(u, L)));
            e._bounds = [o, r, s, u];
          }
          return e._bounds;
        },
        ft = function (e, o, r = 0) {
          const s = at(o);
          return e[0] >= s[0] - r && e[0] <= s[1] + r && e[1] >= s[2] - r && e[1] <= s[3] + r;
        },
        ue = function (e, o) {
          if (!ft(e, o)) return !1;
          let r = !1;
          for (let s = 0, u = o.length - 1; s < o.length; u = s++) {
            const _ = o[s],
              L = o[u];
            _[1] > e[1] != L[1] > e[1] && e[0] < ((L[0] - _[0]) * (e[1] - _[1])) / (L[1] - _[1]) + _[0] && (r = !r);
          }
          return r;
        },
        se = function (e, o, r = !0, s = 1 / 0) {
          if (!ft(e, o, s)) return 1 / 0;
          let u = 1 / 0;
          for (let _ = 0; _ < o.length - (r ? 0 : 1); _++) {
            const L = o[_],
              Ae = o[(_ + 1) % o.length],
              Pe = Ae[0] - L[0],
              Te = Ae[1] - L[1],
              it = Math.max(0, Math.min(1, ((e[0] - L[0]) * Pe + (e[1] - L[1]) * Te) / (Pe * Pe + Te * Te || 1))),
              dt = e[0] - L[0] - it * Pe,
              Ue = e[1] - L[1] - it * Te;
            u = Math.min(u, dt * dt + Ue * Ue);
          }
          return Math.sqrt(u);
        },
        Ve = function (e, o = 1) {
          for (let r = 0; r < o; r++) {
            const s = [];
            for (let u = 0; u < e.length; u++) {
              const _ = e[u],
                L = e[(u + 1) % e.length];
              s.push(
                [_[0] * 0.82 + L[0] * 0.18, _[1] * 0.82 + L[1] * 0.18],
                [_[0] * 0.18 + L[0] * 0.82, _[1] * 0.18 + L[1] * 0.82],
              );
            }
            e = s;
          }
          return e;
        },
        ge = function (e, o, r = 1 / 0) {
          let s = { distance: 1 / 0, height: 0, along: 0, width: o.width, flow: [0, 1] };
          if (!ft(e, o.line, r)) return s;
          let u = 1 / 0;
          for (let _ = 0; _ < o.line.length - 1; _++) {
            const L = o.line[_],
              Ae = o.line[_ + 1],
              Pe = Ae[0] - L[0],
              Te = Ae[1] - L[1],
              it = Pe * Pe + Te * Te,
              dt = Math.max(0, Math.min(1, ((e[0] - L[0]) * Pe + (e[1] - L[1]) * Te) / (it || 1))),
              Ue = e[0] - L[0] - Pe * dt,
              wt = e[1] - L[1] - Te * dt,
              St = Ue * Ue + wt * wt;
            if (St < u) {
              u = St;
              const Nt = o.lengths[_] + Math.sqrt(it) * dt;
              ((s.along = Nt),
                (s.flow = [Pe / Math.sqrt(it), Te / Math.sqrt(it)]),
                (s.width = o.widths ? o.widths[_] * (1 - dt) + o.widths[_ + 1] * dt : o.width),
                (s.height = o.upstreamLevel + ((o.downstreamLevel - o.upstreamLevel) * Nt) / o.length));
            }
          }
          if (((s.distance = Math.sqrt(u)), o.bridgeDrop)) {
            const _ = o.lengths[2];
            s.height = s.along < _ - 0.35 ? 0 : s.along > _ + 0.8 ? -0.4 : (-0.4 * (s.along - _ + 0.35)) / 1.15;
          }
          if (o.name === "Riviere_vers_le_grand_etang") {
            const _ = o.lengths[3];
            s.height =
              s.along < _ - 0.3
                ? 0.3
                : s.along > _ + 0.7
                  ? Math.max(0, (0.04 * (o.length - s.along)) / (o.length - _))
                  : 0.3 - 0.26 * (s.along - _ + 0.3);
          }
          if (o.name === "Bief_du_moulin") {
            const _ = o.lengths[o.dropPointIndex ?? o.line.length - 8];
            s.height =
              s.along < _ - 0.35
                ? 0.88 + 0.14 * (1 - s.along / (_ - 0.35))
                : s.along > _ + 0.65
                  ? 0.12 - (0.08 * (s.along - _)) / (o.length - _)
                  : 0.88 - 0.76 * (s.along - _ + 0.35);
          }
          // V32 : l'eau coule plus bas que la prairie dans les tronçons naturels.
          const sink32 = globalThis.MoulinV32.riverbeds ? globalThis.MoulinV32.riverbeds.sink(o, s.along) : 0;
          return (sink32 && (s.height -= sink32), s);
        },
        ae = function (e, o = 0) {
          return (
            Re.some((r) => ue(e, r.poly)) ||
            ee.some((r) => ((s) => s.distance < s.width / 2 + o)(ge(e, r, r.maxWidth / 2 + o)))
          );
        },
        be = function (e, o, r) {
          const s = e - r.cx,
            u = o - r.cz,
            _ = Math.cos(r.angle),
            L = Math.sin(r.angle),
            Ae = s * _ - u * L,
            Pe = s * L + u * _;
          return Math.max(r.u0 - Ae, Ae - r.u1, r.v0 - Pe, Pe - r.v1);
        },
        ne = function (e, o, r) {
          for (const s of w) {
            const u = be(e, o, s),
              _ = Math.cos(s.angle),
              L = Math.sin(s.angle),
              Ae = (e - s.cx) * _ - (o - s.cz) * L,
              Pe = s.name === "Dependance" && Ae > 3.1,
              Te = s.name === "Moulin" ? 1.9 : s.name === "Dependance" ? 2.7 : 0.42;
            if (u < Te) {
              const it = 1 - a.MathUtils.smoothstep(u, s.name === "Dependance" ? 1.45 : 0, Te);
              r = a.MathUtils.lerp(r, Math.min(r, s.level), it);
            }
          }
          return r;
        },
        K = function (e, o, r) {
          const s = [e, o];
          let u = 1 / 0;
          for (const _ of Re)
            ue(s, _.poly) && (u = Math.min(u, _.level - 0.24 - Math.min(0.7, se(s, _.poly, !0, 3) * 0.22)));
          for (const _ of ee) {
            const L = ge(s, _, _.maxWidth / 2 + 26),
              Ae = L.distance - L.width / 2;
            if (Ae < 0.62) u = Math.min(u, L.height - 0.44);
            else if (Ae < 26 && !fe(e, o) && !(e > -7 && e < 23 && o > -14 && o < 20)) {
              const Pe = L.height + 0.1 + Math.max(0, Ae - 0.62) * 0.1 + 0.004 * Ae * Ae;
              Number.isFinite(r) && (r = a.MathUtils.lerp(r, Math.min(r, Pe), 1 - a.MathUtils.smoothstep(Ae, 10, 26)));
            }
          }
          return Number.isFinite(u) ? Math.min(r, u) : r;
        },
        fe = function (e, o) {
          return (
            jt(e, o, 0.65) ||
            Math.hypot(e - N.seat.centre[0], o - N.seat.centre[1]) < 2.6 ||
            ue([e, o], N.forecourt) ||
            se([e, o], N.forecourt, !0, 1.4) < 1.4 ||
            ue([e, o], N.upperTerrace) ||
            ue([e, o], E) ||
            se([e, o], B, !1, 1.7) < 1.7
          );
        },
        mt = function (e, o) {
          const r = Y[0],
            s = Y[1],
            u = s[0] - r[0],
            _ = s[1] - r[1],
            L = Math.hypot(u, _),
            Ae = -_ / L,
            Pe = u / L;
          return {
            along: ((e - r[0]) * u + (o - r[1]) * _) / L,
            side: (e - r[0]) * Ae + (o - r[1]) * Pe,
            length: L,
            nx: Ae,
            nz: Pe,
          };
        },
        Ct = function (e, o, r = 14) {
          if (!ft(e, o.points, r)) return null;
          let s = null;
          for (let u = 0; u < o.points.length - 1; u++) {
            const _ = o.points[u],
              L = o.points[u + 1],
              Ae = L[0] - _[0],
              Pe = L[1] - _[1],
              Te = Ae * Ae + Pe * Pe,
              it = Math.sqrt(Te),
              dt = a.MathUtils.clamp(((e[0] - _[0]) * Ae + (e[1] - _[1]) * Pe) / Te, 0, 1),
              Ue = e[0] - _[0] - Ae * dt,
              wt = e[1] - _[1] - Pe * dt,
              St = Math.hypot(Ue, wt);
            (!s || St < s.d) &&
              (s = {
                d: St,
                signed: ((-Pe * Ue + Ae * wt) / it) * (o.side || 1),
                height: o.levels ? o.levels[u] * (1 - dt) + o.levels[u + 1] * dt : 0,
                x: _[0] + Ae * dt,
                z: _[1] + Pe * dt,
                segment: u,
                t: dt,
              });
          }
          return s;
        },
        Pt = function (e, o, r) {
          return Ct([e, o], r, 6);
        },
        jt = function (e, o, r = 0) {
          return N.hillRoutes.some((s) => {
            const u = Pt(e, o, s);
            return u && u.d < s.width * 0.5 + r;
          });
        },
        Dt = function (e, o, r) {
          var dt;
          if (e < -56 || e > -5.5 || o < -73 || o > 4) return r;
          const s = [e, o],
            u = a.MathUtils.clamp,
            _ = a.MathUtils.smoothstep,
            L = _(-e, 10, 17) * (1 - _(-e, 45, 56)) * _(-o, 2, 12) * (1 - _(-o, 65, 73));
          let Ae = 4.28 + Math.max(0, -e - 17) * 0.28 + Math.max(0, -o - 26) * 0.06;
          ((Ae += 0.18 * Math.sin(e * 0.21 + o * 0.19) * Math.sin(o * 0.14)),
            L > 0 && (r = a.MathUtils.lerp(r, Ae, L)));
          const Pe = N.seat,
            Te = Math.hypot((e - Pe.centre[0]) / 2.5, (o - Pe.centre[1]) / 2);
          (Te < 2 && (r = a.MathUtils.lerp(r, Pe.level, 1 - _(Te, 0.75, 2))), ue(s, N.upperTerrace) && (r = q + 3.2));
          let it = null;
          for (const Ue of N.hillRoutes) {
            const wt = Pt(e, o, Ue);
            if (!wt) continue;
            const St = Math.max(0, wt.d - Ue.width * 0.5);
            (!it || St < it.d) && (it = { r: Ue, s: wt, d: St });
          }
          if (it) {
            const { r: Ue, s: wt, d: St } = it,
              Nt = (dt = Ue.kinds) == null ? void 0 : dt[wt.segment],
              Mo = wt.height - (Nt === "steps" ? 0.21 : 0.07),
              so = 1 - _(St, 0.32, 2.55);
            so > 0 && (r = a.MathUtils.lerp(r, Mo, so));
          }
          return (ue(s, N.forecourt) && (r = q - 0.025), K(e, o, ne(e, o, r)));
        },
        we = function (e, o) {
          return N.lawns.some((r) => ft([e, o], r.poly, 0) && ue([e, o], r.poly));
        },
        We = function (e, o, r) {
          const s = [e, o],
            u = Re[0];
          e > 7 && o < -17 && (r = Ft(e, o));
          const _ = K(e, o, 1 / 0);
          if (Number.isFinite(_) && ae(s, 0.65)) return _;
          if (o > 12 && e < 65 && ft(s, u.poly, 66) && !ue(s, u.poly)) {
            const Ue = se(s, u.poly, !0, 66);
            if (Ue < 66) {
              let St = 0.1 + 0.105 * Math.max(0, Ue - 0.45) + 0.001 * Ue * Ue,
                Nt = null;
              for (const so of Ie) {
                if (!so.side) continue;
                const no = Ct(s, so, 55);
                no && (!Nt || no.d < Nt.s.d) && (Nt = { s: no, path: so });
              }
              if (Nt) {
                const { s: so, path: no } = Nt,
                  Lo =
                    so.segment === 0
                      ? a.MathUtils.smoothstep(so.t, 0, 0.8)
                      : so.segment === no.points.length - 2
                        ? 1 - a.MathUtils.smoothstep(so.t, 0.2, 1)
                        : 1,
                  lo = no.rise * (0.88 + 0.12 * Math.sin(so.x * 0.035 + so.z * 0.046));
                ((St += lo * a.MathUtils.smoothstep(so.signed, -4, 0.8) * Lo),
                  (St += Math.max(0, so.signed - 1) * 0.12 + Math.pow(Math.max(0, so.signed - 1), 2) * 0.002));
              }
              const Mo = (1 - a.MathUtils.smoothstep(Ue, 44, 66)) * a.MathUtils.smoothstep(o, 12, 24);
              r = a.MathUtils.lerp(r, St, Mo);
            }
          }
          if (e > -42 && e < -7 && o > -20 && o < 6) {
            const Ue = ue(s, N.upperTerrace) ? 0 : se(s, N.upperTerrace, !0, 7),
              wt = q + 3.2;
            Ue < 7 && (r = a.MathUtils.lerp(r, wt, 1 - a.MathUtils.smoothstep(Ue, 0.1, 7)));
            const St = mt(e, o);
            St.along >= -0.25 && St.along < St.length + 0.3 && St.side > 0 && St.side < 3.1 && (r = q + 0.2);
          }
          if (e > -30 && e < -5 && o > -23 && o < -3.5) {
            const Ue = Ct(s, { points: N.rockFace }, 18);
            if (Ue) {
              const wt = -Ue.signed;
              if (wt > -0.25) {
                let St = q + 3.2 + Math.max(0, wt - 1.8) * 0.25;
                const Nt =
                  (1 - a.MathUtils.smoothstep(Ue.d, 9, 17)) *
                  a.MathUtils.smoothstep(-o, 3.3, 5) *
                  (1 - a.MathUtils.smoothstep(-o, 19, 23));
                r = a.MathUtils.lerp(r, St, Nt);
              } else Ue.d < 2.5 && (r = Math.min(r, q + 0.22));
            }
          }
          ue(s, N.upperTerrace) && (r = q + 3.2);
          const L = ue(s, N.forecourt) ? 0 : se(s, N.forecourt, !0, 4);
          L < 4 && (r = a.MathUtils.lerp(r, Math.min(r, q - 0.04), 1 - a.MathUtils.smoothstep(L, 1.5, 4)));
          const Ae = Ct(s, { points: N.drive, levels: N.driveLevels }, 27);
          if (Ae && Ae.d < 27 && o < -22) {
            const Ue = Ae.height + 0.1 + Math.max(0, Ae.d - 1.65) * (Ae.signed > 0 ? 0.34 : 0.05);
            r = a.MathUtils.lerp(r, Math.min(r, Ue), 1 - a.MathUtils.smoothstep(Ae.d, 17, 27));
          }
          Ae && Ae.d < 3.8 && (r = a.MathUtils.lerp(r, Ae.height, 1 - a.MathUtils.smoothstep(Ae.d, 1.55, 3.8)));
          const Pe = Ct(s, { points: B, levels: $e.hillWalkLevels }, 2.5);
          Pe && Pe.d < 2.5 && (r = a.MathUtils.lerp(r, Pe.height - 0.17, 1 - a.MathUtils.smoothstep(Pe.d, 1.05, 2.5)));
          const Te = Ie[2];
          for (const Ue of Ie) {
            if (Ue.side) continue;
            const wt = Ct(s, Ue, 2.6);
            wt && wt.d < 2.6 && (r = a.MathUtils.lerp(r, wt.height, 1 - a.MathUtils.smoothstep(wt.d, 0.65, 2.6)));
          }
          const it = Te.points.at(-1),
            dt = Math.max(Math.abs(e - it[0]) / 2.1, Math.abs(o - it[1]) / 1.7);
          if (
            (dt < 1.7 && (r = a.MathUtils.lerp(r, 10.2, 1 - a.MathUtils.smoothstep(dt, 1, 1.7))),
            !(e > -25 && e < 22 && o > 6 && o < 20))
          )
            for (const Ue of Re) {
              const wt = se(s, Ue.poly, !0, 1.2);
              wt > 1.2 ||
                ue(s, Ue.poly) ||
                ee.some((St) => {
                  const Nt = ge(s, St, St.maxWidth / 2 + 0.5);
                  return Nt.distance < Nt.width / 2 + 0.35;
                }) ||
                (r = a.MathUtils.lerp(
                  r,
                  Ue.level + 0.1 + Math.max(0, wt - 0.45) * 0.105,
                  1 - a.MathUtils.smoothstep(wt, 0.45, 1.2),
                ));
            }
          return ((ue(s, Ee) || ue(s, bt)) && (r = Math.min(r, q - 0.025)), K(e, o, ne(e, o, r)));
        },
        yt = function (e, o) {
          return Dt(e, o, We(e, o, Ft(e, o)));
        },
        Ft = function (e, o) {
          const r = [e, o],
            s = se(r, de, !1);
          let _ =
              0.8 +
              Math.max(0, (e + o * 0.25) / 120) * 1.5 +
              20 * Math.pow(Math.min(s / 92, 1), 1.5) +
              1.1 * Math.sin(e * 0.027 + o * 0.016) +
              0.7 * Math.cos(o * 0.037 - e * 0.009),
            L = 1e9,
            Ae = 1;
          for (const Ue of Re) {
            const wt = se(r, Ue.poly, !0, 20);
            if (ue(r, Ue.poly)) return Ue.level - 0.18 - Math.min(1, wt * 0.3);
            wt < L && ((L = wt), (Ae = Ue.level + 0.06));
          }
          if (L < 20) {
            const Ue = Math.min(1, L / 20);
            _ = Ae + (_ - Ae) * Ue * Ue;
          }
          const Pe = Math.max(Math.abs(e + 6) / 24, Math.abs(o - 6) / 21);
          if (Pe < 1.7) {
            const Ue = Math.max(0, Math.min(1, (Pe - 1) / 0.7));
            _ = q * (1 - Ue) + _ * Ue;
          }
          const Te = Math.exp(-Math.pow((e + 24) / 23, 2) - Math.pow((o + 15) / 23, 2)),
            it = Math.max(0, Math.min(1, (-e - 10) / 9)) * Math.max(0, Math.min(1, (4 - o) / 8));
          if ((e > -61 && e < -9 && o > -55 && o < 5 && (_ = Math.max(_, q + 6.6 * Te * it)), ft(r, B, 2.5))) {
            let Ue = 1 / 0,
              wt = _;
            for (let St = 0; St < B.length - 1; St++) {
              const Nt = B[St],
                Mo = B[St + 1],
                so = Mo[0] - Nt[0],
                no = Mo[1] - Nt[1],
                Lo = Math.max(0, Math.min(1, ((e - Nt[0]) * so + (o - Nt[1]) * no) / (so * so + no * no))),
                lo = Math.hypot(e - Nt[0] - Lo * so, o - Nt[1] - Lo * no);
              lo < Ue && ((Ue = lo), (wt = $e.hillWalkLevels[St] * (1 - Lo) + $e.hillWalkLevels[St + 1] * Lo));
            }
            if (Ue < 2.5) {
              const St = Math.max(0, Math.min(1, (Ue - 0.7) / 1.8));
              _ = wt * (1 - St) + _ * St;
            }
          }
          if (e > 4 && e < 146 && o > -50 && o < 10) {
            const Ue = Math.max(0, Math.min(1, (e - 12) / 125)),
              wt = 0.82 + 0.58 * Ue;
            _ = Math.min(_, wt + Math.pow(Math.max(0, Math.abs(o + 20) - 17) * 0.12, 2));
          }
          const dt = Math.hypot((e - M[0]) / 23, (o - M[1] - 5) / 20);
          if (dt < 1.3) {
            const Ue = Math.max(0, Math.min(1, (dt - 0.7) / 0.6));
            _ = (0.46 + 0.018 * Math.max(0, -e + M[0])) * (1 - Ue) + _ * Ue;
          }
          if (L < 1.6) {
            let Ue = L / 1.6;
            ((Ue = Ue * Ue * (3 - 2 * Ue)), (_ = Ae * (1 - Ue) + _ * Ue));
          }
          for (const Ue of ee) {
            const wt = ge(r, Ue, Ue.maxWidth / 2 + 5),
              St = wt.distance - wt.width / 2,
              Nt = Ue.name === "Bief_du_moulin" && wt.along > Ue.lengths[Ue.line.length - 3];
            if (St < (Nt ? 0.34 : 0)) return wt.height - 0.52;
            if (Nt && St < 2.4) {
              _ = Math.max(_, q);
              continue;
            }
            St < 5 && (_ = Math.min(_, wt.height + 0.1 + St * 0.19 + St * St * 0.042));
          }
          return _;
        },
        Kt = function (e, o, r) {
          if (
            Ie.some((_) => {
              const L = Ct([e, o], _, 2);
              return L && L.d < 2;
            }) ||
            (e > -35 && e < 5 && o > -18 && o < 18) ||
            we(e, o) ||
            fe(e, o)
          )
            return 0;
          const s = a.MathUtils.smoothstep(r, 0.55, 1.4),
            u = 1 - a.MathUtils.smoothstep(Math.max(Math.abs(e + 6) / 33, Math.abs(o - 5) / 26), 1, 1.35);
          return u > 0.999 || Se.some((_) => se([e, o], _, !1, 2) < 2) || se([e, o], B, !1, 2) < 2
            ? 0
            : (W.noise(e * 0.075 + 91, o * 0.08 + 17) - 0.5) * 0.28 * s * (1 - u);
        },
        oo = function (e, o = 0.33) {
          const r = e.attributes.position,
            s = [];
          for (let u = 0; u < r.count; u++) s.push(r.getX(u) * o, r.getZ(u) * o);
          return (e.setAttribute("uv", new a.Float32BufferAttribute(s, 2)), e);
        },
        uo = function (e, o, r, s, u = Xe) {
          const _ = new a.Shape(e.map((Pe) => new a.Vector2(Pe[0], -Pe[1]))),
            L = new a.ShapeGeometry(_);
          (L.rotateX(-Math.PI / 2), oo(L));
          const Ae = F(L, r, s, u);
          return ((Ae.position.y = o), Ae);
        },
        Tt = function (e, o, r, s, u = yt, _ = Xe) {
          const L = [];
          for (let it = 0; it < e.length - 1; it++) {
            const dt = e[it],
              Ue = e[it + 1],
              wt = Math.max(1, Math.ceil(Math.hypot(Ue[0] - dt[0], Ue[1] - dt[1]) / 1.2));
            for (let St = 0; St < wt; St++)
              L.push([dt[0] + ((Ue[0] - dt[0]) * St) / wt, dt[1] + ((Ue[1] - dt[1]) * St) / wt]);
          }
          L.push(e[e.length - 1]);
          const Ae = [],
            Pe = [];
          for (let it = 0; it < L.length; it++) {
            const dt = L[Math.max(0, it - 1)],
              Ue = L[Math.min(L.length - 1, it + 1)],
              wt = L[it],
              St = typeof o == "function" ? o(wt[0], wt[1]) : o,
              Nt = Ue[0] - dt[0],
              Mo = Ue[1] - dt[1],
              so = Math.hypot(Nt, Mo) || 1;
            for (const no of [-1, 1]) {
              const Lo = wt[0] - (Mo / so) * St * 0.5 * no,
                lo = wt[1] + (Nt / so) * St * 0.5 * no;
              Ae.push(Lo, u(Lo, lo) + 0.08, lo);
            }
            if (it < L.length - 1) {
              const no = it * 2;
              Pe.push(no, no + 3, no + 2, no, no + 1, no + 3);
            }
          }
          const Te = new a.BufferGeometry();
          return (
            Te.setAttribute("position", new a.Float32BufferAttribute(Ae, 3)),
            Te.setIndex(Pe),
            Te.computeVertexNormals(),
            oo(Te, r === D.waterExport ? 0.11 : 0.5),
            F(Te, r, s, _)
          );
        },
        eo = function (e) {
          const o = e.attributes.position,
            r = [];
          for (let s = 0; s < o.count; s++)
            r.push((o.getX(s) - Q[0]) / (Q[1] - Q[0]), (o.getZ(s) - Q[2]) / (Q[3] - Q[2]));
          e.setAttribute("uv", new a.Float32BufferAttribute(r, 2));
        },
        Eo = function () {
          if (O || In.frames < Xo.deferredFrames26 || (z != null && z.shouldSkipReflection())) {
            zo.value = 0;
            return;
          }
          const e = Yo[0];
          if (
            !e ||
            Do ||
            (jo === ho &&
              an === ko.fov &&
              Ko.distanceToSquared(ko.position) < 1e-10 &&
              1 - Math.abs(ln.dot(ko.quaternion)) < 1e-10)
          )
            return;
          Do = !0;
          const o = [
            ...io,
            ...tr.reflectionHidden,
            ...((C == null ? void 0 : C.reflectionHidden) || []),
            ...Ma.grassTiles,
            wa.group || Xe.getObjectByName("Cortege_du_cygne_et_des_oies"),
          ].filter(Boolean);
          if (v) {
            const s = Xe.getObjectByName("Reperes_editeur");
            s && o.push(s);
          }
          Uo && o.push(...(Uo.reflectionHidden || [Uo.particles]));
          const r = o.map((s) => s.visible);
          o.forEach((s) => (s.visible = !1));
          for (const s of Ma.terrainTiles) s.mesh.geometry.index = s.coarse;
          try {
            (e.userData.capture(xo, qn, ko),
              e.material.uniforms.reflectionMatrix.value.multiplyMatrices(
                e.material.uniforms.textureMatrix.value,
                new a.Matrix4().copy(e.matrixWorld).invert(),
              ),
              Xo.captures++,
              (zo.value = 1),
              Ko.copy(ko.position),
              ln.copy(ko.quaternion),
              (jo = ho),
              (an = ko.fov));
          } finally {
            for (const s of Ma.terrainTiles) s.mesh.geometry.index = s.fine;
            (o.forEach((s, u) => (s.visible = r[u])), (Do = !1));
          }
        },
        tn = function (e, o) {
          return {
            tDiffuse: (e == null ? void 0 : e.material.uniforms.tDiffuse) || { value: W.water },
            reflectionMatrix: (e == null ? void 0 : e.material.uniforms.reflectionMatrix) || { value: new a.Matrix4() },
            planarReflection28: zo,
            rippleMap: { value: W.water },
            depthMap: { value: Vt },
            bedMap: { value: mo },
            atlasBounds: { value: new a.Vector4(...Q) },
            time: ao,
            daylight: wo,
            flowSpeed: { value: o },
            sunDirection32: globalThis.MoulinV32.uniforms.sunDirection,
            sunColor32: globalThis.MoulinV32.uniforms.sunColor,
            turbulence32: globalThis.MoulinV32.uniforms.turbulence,
          };
        },
        fn = function (e, o, r, s, u) {
          const _ = [
              -o / 2,
              s,
              -r / 2,
              -o / 2,
              s,
              r / 2,
              0,
              s + u,
              r / 2,
              -o / 2,
              s,
              -r / 2,
              0,
              s + u,
              r / 2,
              0,
              s + u,
              -r / 2,
              0,
              s + u,
              -r / 2,
              0,
              s + u,
              r / 2,
              o / 2,
              s,
              r / 2,
              0,
              s + u,
              -r / 2,
              o / 2,
              s,
              r / 2,
              o / 2,
              s,
              -r / 2,
            ],
            L = new a.BufferGeometry();
          L.setAttribute("position", new a.Float32BufferAttribute(_, 3));
          const Ae = [];
          for (let dt = 0; dt < _.length; dt += 3) Ae.push(_[dt + 2] * 0.4, (s + u - _[dt + 1]) * 0.83);
          (L.setAttribute("uv", new a.Float32BufferAttribute(Ae, 2)),
            L.computeVertexNormals(),
            F(L, D.slate, "Toiture_ardoise", e));
          for (const dt of [-r / 2 + 0.3, r / 2 - 0.3]) {
            const Ue = new a.BufferGeometry();
            (Ue.setAttribute(
              "position",
              new a.Float32BufferAttribute([-o / 2 + 0.3, s, dt, o / 2 - 0.3, s, dt, 0, s + u - 0.1, dt], 3),
            ),
              Ue.computeVertexNormals(),
              F(
                Ue,
                new a.MeshStandardMaterial({ color: xe("#95907c"), side: a.DoubleSide, roughness: 1 }),
                "Pignon_granit",
                e,
              ));
          }
          g(0.16, 0.16, r, [0, s + u, 0], D.slate, "Faitage", e);
          for (const dt of [-o / 2, o / 2]) g(0.16, 0.19, r, [dt, s - 0.035, 0], D.wood, "Epaisseur_de_rive", e);
          for (const dt of [-r / 2, r / 2])
            for (const Ue of [-1, 1])
              Io([(Ue * o) / 2, s - 0.02, dt], [0, s + u - 0.02, dt], 0.15, 0.17, D.slate, "Rive_du_pignon", e);
          const Pe = H("#e6eff4", { roughness: 0.96, side: a.DoubleSide }),
            Te = new a.Mesh(L.clone(), Pe);
          ((Te.name = "Neige_sur_toiture"),
            (Te.position.y = 0.105),
            (Te.visible = !1),
            (Te.userData.exportSkip = !0),
            e.add(Te),
            rt.push(Te));
          const it = H("#927768", { roughness: 0.88 });
          for (let dt = -r / 2 + 0.19; dt < r / 2; dt += 0.39) {
            const Ue = F(new a.CylinderGeometry(0.135, 0.145, 0.4, 8), it, "Tuile_faitiere_patinee", e);
            (Ue.position.set(0, s + u + 0.075, dt), (Ue.rotation.x = Math.PI / 2));
          }
        },
        Vo = function (e, o, r, s, u, _, L = !1, Ae = 0, Pe = "#684d40", Te = !1) {
          const it = new a.Group();
          ((it.name = L === "glazed" ? "Porte_vitree_sur_terrasse" : L ? "Ouverture_porte" : "Ouverture_fenetre"),
            it.position.set(o, r, s),
            (it.rotation.y = Ae),
            e.add(it));
          for (const St of [-1, 1]) g(0.16, _ + 0.28, 0.32, [St * (u / 2 + 0.07), 0, 0], D.trim, "Jambage_granit", it);
          for (const St of [-1, 1])
            g(
              u + 0.16,
              0.15,
              0.34,
              [0, St * (_ / 2 + 0.065), 0],
              D.trim,
              St === 1 ? "Linteau_pierre" : "Seuil_pierre",
              it,
            );
          const dt = !L || L === "glazed",
            Ue = "glass:" + dt,
            wt =
              ke.get(Ue) ||
              H(dt ? "#293d3c" : "#403f32", {
                roughness: dt ? 0.13 : 0.8,
                metalness: dt ? 0.18 : 0,
                envMapIntensity: dt ? 0.5 : 0.2,
                emissive: xe("#d7aa75"),
                emissiveIntensity: 0,
              });
          if ((ke.set(Ue, wt), g(u, _, 0.055, [0, 0, 0.025], wt, dt ? "Vitrage" : "Porte", it), De.push(wt), dt)) {
            const St = ke.get(Pe) || H(Pe, { roughness: 0.74 });
            ke.set(Pe, St);
            for (const Nt of [-u / 2, 0, u / 2]) g(Te ? 0.045 : 0.038, _, 0.06, [Nt, 0, 0.13], St, "Menuiserie", it);
            for (const Nt of Te ? [-_ / 2, _ / 2] : [-_ / 2, -_ / 6, _ / 6, _ / 2])
              g(u, 0.043, 0.06, [0, Nt, 0.13], St, "Traverse_menuiserie", it);
            (Te && g(0.045, 0.14, 0.045, [-0.065, -_ * 0.16, 0.19], D.metal, "Poignee_de_fenetre", it),
              g(u + 0.14, 0.07, 0.25, [0, -_ / 2 - 0.12, 0.075], D.trim, "Appui", it));
          }
          return it;
        },
        Io = function (e, o, r, s, u, _, L) {
          const Ae = new a.Vector3(...e),
            Pe = new a.Vector3(...o),
            Te = Pe.clone().sub(Ae),
            it = F(new a.BoxGeometry(r, Te.length(), s), u, _, L);
          return (
            it.position.copy(Ae.add(Pe).multiplyScalar(0.5)),
            it.quaternion.setFromUnitVectors(new a.Vector3(0, 1, 0), Te.normalize()),
            it
          );
        },
        Dn = function (e, o, r) {
          const s = new a.BufferGeometry(),
            u = [...o[0], ...o[1], ...o[2], ...o[0], ...o[2], ...o[3]];
          (s.setAttribute("position", new a.Float32BufferAttribute(u, 3)), s.computeVertexNormals(), oo(s, 0.6));
          const _ = D.slate.clone();
          return ((_.side = a.DoubleSide), F(s, _, r, e));
        },
        Je = function (e, o, r = q + 0.015, s = 0.42) {
          const u = He(e),
            _ = He(o),
            L = Math.hypot(u[0] - _[0], u[1] - _[1]),
            Ae = g(L, r, s, [(u[0] + _[0]) / 2, r / 2 + 0.05, (u[1] + _[1]) / 2], D.stone, "Muret_de_berge", Mt);
          ((Ae.rotation.y = -Math.atan2(_[1] - u[1], _[0] - u[0])),
            g(s, r, s, [u[0], r / 2 + 0.05, u[1]], D.stone, "Angle_muret", Mt));
        },
        ot = function (e, o, r, s, u) {
          const _ = new a.Group();
          ((_.name = u), _.position.set(e, 0, o), (_.rotation.y = s), d.add(_));
          for (const Pe of [-r * 0.39, r * 0.39])
            for (const Te of [-0.28, 0.28]) g(0.075, 0.29, 0.075, [Pe, 0.145, Te], xt, "Pied_du_salon", _);
          g(r, 0.18, 0.78, [0, 0.37, 0], ye, "Structure_du_salon", _);
          const L = r > 1.3 ? 3 : 1;
          for (let Pe = 0; Pe < L; Pe++)
            g(r / L - 0.022, 0.15, 0.65, [-r / 2 + ((Pe + 0.5) * r) / L, 0.54, 0.035], Z, "Coussin_corail", _);
          for (const Pe of [-r / 2, r / 2]) g(0.12, 0.36, 0.79, [Pe, 0.57, 0], Z, "Accoudoir_corail", _);
          const Ae = g(r, 0.5, 0.14, [0, 0.72, -0.32], nt, "Dossier_corail", _);
          Ae.rotation.x = -0.1;
        },
        Kr = function (e, o, r, s, u = Yr) {
          const _ = new a.Vector3(...o).sub(new a.Vector3(...e)),
            L = new a.Quaternion().setFromUnitVectors(new a.Vector3(0, 1, 0), _.clone().normalize()),
            Ae = new a.Euler().setFromQuaternion(L);
          u.add(Fe, [(e[0] + o[0]) / 2, (e[1] + o[1]) / 2, (e[2] + o[2]) / 2], [r, _.length(), r], s, [
            Ae.x,
            Ae.y,
            Ae.z,
          ]);
        },
        ma = function (e, o, r, s, u, _ = 10, L = 1, Ae = Zr) {
          const Pe = typeof u == "string" ? xe(u).lerp(xe("#8ba945"), 0.52) : u;
          Ae.add(W.assetGeometry("Bush_Common"), [e, o - s * 0.56, r], [s * 1.35, s * L * 1.35, s * 1.35], Pe, [
            0,
            e * 0.7 + r * 0.6,
            0,
          ]);
        },
        ur = function (e, o) {
          const r = new a.SphereGeometry(1, e, o),
            s = r.attributes.position;
          for (let u = 0; u < s.count; u++) {
            const _ = s.getX(u),
              L = s.getY(u),
              Ae = s.getZ(u),
              Pe =
                1 +
                0.065 * Math.sin(_ * 5.3 + L * 3.1) * Math.cos(Ae * 4.1 - L * 3.4) +
                0.035 * Math.sin(_ * 10.2 - Ae * 7.3);
            s.setXYZ(u, _ * Pe, L * Pe, Ae * Pe);
          }
          return (r.computeVertexNormals(), r.toNonIndexed());
        },
        Za = function (e, o, r, s = 0, u = yt(e, o), _ = !1) {
          const L = s === 2 ? "birch" : s === 1 ? "pine" : "oak";
          ca.push({
            x: e,
            z: o,
            height: r,
            species: L,
            diameter: L === "birch" ? r * 0.019 : L === "pine" ? r * 0.028 : r * (_ ? 0.056 : 0.041),
            spread: L === "oak" ? U(0.85, 1.18) : U(0.85, 1.08),
            rotation: U(0, 6.283),
            variant: Math.floor(U(0, 4)),
          });
        },
        dr = function (e, o, r, s = yt(e, o), u = !1) {
          ca.push({
            x: e,
            z: o,
            height: r,
            species: "pine",
            diameter: r * 0.029,
            spread: U(0.85, 1.16),
            rotation: U(0, 6.283),
            variant: Math.floor(U(0, 4)),
          });
        },
        ei = function (e, o, r, s, u, _ = yt(e, o)) {
          for (let L = 0; L < u; L++) {
            const Ae = U(0, 6.28),
              Pe = U(0, s * 0.3),
              Te = r * U(0.65, 1.2),
              it = s * U(0.45, 1.2),
              dt = U(0.017, 0.035),
              Ue = -Math.sin(Ae) * dt,
              wt = Math.cos(Ae) * dt,
              St = e + Math.cos(Ae) * Pe,
              Nt = o + Math.sin(Ae) * Pe,
              Mo = [
                [St, _, Nt],
                [St + Math.cos(Ae) * it * 0.25, _ + Te * 0.66, Nt + Math.sin(Ae) * it * 0.25],
                [St + Math.cos(Ae) * it * 0.66, _ + Te * 0.9, Nt + Math.sin(Ae) * it * 0.66],
                [St + Math.cos(Ae) * it, _ + Te * 0.57, Nt + Math.sin(Ae) * it],
              ],
              so = [];
            for (let Lo = 0; Lo < 3; Lo++) {
              const lo = Mo[Lo],
                Zo = Mo[Lo + 1],
                Ht = 1 - Lo * 0.28;
              so.push(
                lo[0] - Ue * Ht,
                lo[1],
                lo[2] - wt * Ht,
                lo[0] + Ue * Ht,
                lo[1],
                lo[2] + wt * Ht,
                Zo[0] + Ue * Ht * 0.7,
                Zo[1],
                Zo[2] + wt * Ht * 0.7,
                lo[0] - Ue * Ht,
                lo[1],
                lo[2] - wt * Ht,
                Zo[0] + Ue * Ht * 0.7,
                Zo[1],
                Zo[2] + wt * Ht * 0.7,
                Zo[0] - Ue * Ht * 0.7,
                Zo[1],
                Zo[2] - wt * Ht * 0.7,
              );
            }
            const no = new a.BufferGeometry();
            (no.setAttribute("position", new a.Float32BufferAttribute(so, 3)),
              no.computeVertexNormals(),
              Tr.add(no, [0, 0, 0], [1, 1, 1], ["#89934f", "#778844", "#a39c67", "#6a8545"][L % 4]),
              no.dispose());
          }
        },
        Ja = function (e, o, r, s, u, _) {
          e.push(...r, ...s, ...u);
          for (let L = 0; L < 3; L++) o.push(_.r, _.g, _.b);
        },
        $a = function (e, o, r, s = null, u = r) {
          const _ = o[0] - e[0],
            L = o[1] - e[1],
            Ae = Math.hypot(_, L);
          if (Ae < 0.01) return;
          const Pe = (e[0] + o[0]) / 2,
            Te = (e[1] + o[1]) / 2;
          if (
            (Pe > -25 && Pe < 22 && Te > 6 && Te < 20) ||
            ee.some((lo) => {
              if (lo === s) return !1;
              const Zo = ge([Pe, Te], lo, lo.maxWidth / 2 + 0.9);
              return Zo.distance < Zo.width / 2 + 0.65;
            })
          )
            return;
          let it = -L / Ae,
            dt = _ / Ae;
          ae([Pe + it * 0.25, Te + dt * 0.25]) && ((it = -it), (dt = -dt));
          const Ue = [e[0], r + 0.1, e[1]],
            wt = [o[0], u + 0.1, o[1]],
            St = [o[0], u - 0.25, o[1]],
            Nt = [e[0], r - 0.25, e[1]],
            Mo = xe("#655742"),
            so = xe("#72943e");
          (Ja(Ga, Fa, Ue, wt, St, Mo), Ja(Ga, Fa, Ue, St, Nt, Mo));
          const no = [e[0] + it * 0.44, r + 0.1, e[1] + dt * 0.44],
            Lo = [o[0] + it * 0.44, u + 0.1, o[1] + dt * 0.44];
          (Ja(La, Va, Ue, no, Lo, so), Ja(La, Va, Ue, Lo, wt, so), ci++);
        },
        ui = function (e, o, r) {
          const s = new a.BufferGeometry();
          (s.setAttribute("position", new a.Float32BufferAttribute(e, 3)),
            s.setAttribute("color", new a.Float32BufferAttribute(o, 3)),
            s.computeVertexNormals());
          const u = F(s, H("#ffffff", { vertexColors: !0, side: a.DoubleSide, roughness: 1 }), r, Ba);
          return ((u.castShadow = !1), u);
        },
        $i = function () {
          for (const e of wr) {
            const o = e.geometry.attributes.position;
            for (let r = 0; r < o.count; r++) o.setY(r, Rt(o.getX(r), o.getZ(r)) + 0.028);
            ((o.needsUpdate = !0), e.geometry.computeVertexNormals(), e.geometry.computeBoundingSphere());
          }
        },
        es = function (e, o) {
          return N.upperTerraceParts.some((r) => ue([e, o], r.outer) && !r.holes.some((s) => ue([e, o], s)));
        },
        ts = function (e) {
          const o = new a.Group();
          ((o.name = e.name),
            o.position.set(e.position[0], q + 0.08, e.position[1]),
            (o.rotation.y = e.angle),
            jn.add(o));
          const r = new a.Group();
          ((r.name = "Chassis_voiture"), o.add(r));
          const s = [],
            u = new m(H("#ffffff", { vertexColors: !0, roughness: 0.53, metalness: 0.15 }), "Carrosserie", r),
            _ = new m(H("#ffffff", { vertexColors: !0, roughness: 0.35, metalness: 0.08 }), "Vitres", r);
          (u.add(So, [0, 0.61, 0], [1.77, 0.56, 4.2], e.color),
            u.add(So, [0, 0.45, 0], [1.68, 0.23, 4.32], "#36403e"),
            u.add(So, [0, 0.95, -0.38], [1.63, 0.37, 2.3], e.color),
            u.add(So, [0, 1.38, -0.4], [1.51, 0.12, 1.93], e.color));
          const L = g(1.48, 0.52, 0.045, [0, 1.14, 0.75], H("#28464d", { roughness: 0.32 }), "Pare_brise", r);
          L.rotation.x = -0.27;
          const Ae = g(1.47, 0.42, 0.035, [0, 1.13, -1.6], L.material, "Lunette_arriere", r);
          Ae.rotation.x = 0.25;
          for (const it of [-1, 1]) {
            for (const Ue of [-0.87, 0.2]) _.add(So, [it * 0.823, 1.15, Ue], [0.026, 0.36, 0.9], "#2e4a50");
            (u.add(So, [it * 0.837, 1.15, -0.33], [0.05, 0.44, 0.065], e.color),
              u.add(So, [it * 0.88, 0.77, 0.19], [0.026, 0.025, 0.2], "#d0d0c4"));
            const dt = g(0.17, 0.13, 0.28, [it * 0.94, 1.07, 0.78], H(e.color), "Retroviseur", r);
            for (const Ue of [-1.3, 1.27]) {
              const wt = new a.Group();
              (wt.position.set(it * 0.84, 0.34, Ue), r.add(wt));
              const St = new a.Group();
              (wt.add(St),
                s.push({
                  pivot: wt,
                  spin: St,
                  front: Ue > 0,
                  side: it,
                  z: Ue,
                  x: it * 0.84,
                  restY: 0.34,
                  radius: 0.33,
                }));
              const Nt = F(new a.CylinderGeometry(0.33, 0.33, 0.19, 12), H("#242b29"), "Roue_voiture", St);
              Nt.rotation.z = Math.PI / 2;
              const Mo = F(
                new a.CylinderGeometry(0.22, 0.22, 0.196, 8),
                H("#a9ada6", { metalness: 0.32 }),
                "Jante_voiture",
                St,
              );
              Mo.rotation.z = Math.PI / 2;
            }
            (u.add(So, [it * 0.61, 0.7, 2.114], [0.43, 0.14, 0.032], "#e3e6d8"),
              u.add(So, [it * 0.65, 0.75, -2.115], [0.31, 0.13, 0.03], "#8c3b2b"));
          }
          (u.finish(), _.finish(), g(0.46, 0.1, 0.035, [0, 0.5, 2.18], H("#ced9dd"), "Plaque_sans_identifiant", r));
          const Pe = new a.Group();
          (Pe.position.set(-0.38, 1.02, 0.56), r.add(Pe));
          const Te = F(new a.TorusGeometry(0.19, 0.025, 6, 16), H("#252a2b"), "Volant", Pe);
          ((Te.rotation.x = -0.32), g(0.8, 0.24, 0.4, [0, 0.95, 0.68], H("#30383a"), "Tableau_de_bord", r));
          for (const it of [-1, 1])
            (g(0.59, 0.13, 0.57, [it * 0.39, 0.65, -0.17], H("#32383a"), "Siege", r),
              g(0.59, 0.57, 0.12, [it * 0.39, 0.99, -0.49], H("#32383a"), "Dossier", r));
          return (
            Object.defineProperty(e, "rig24", {
              value: { root: o, frame: r, wheels: s, steering: Pe, parent: jn },
              enumerable: !1,
            }),
            o
          );
        },
        qo = function (e = 0, o = 1) {
          return ((kr = (Math.imul(kr, 1664525) + 1013904223) >>> 0), e + ((o - e) * kr) / 4294967296);
        },
        ns = function (e) {
          const o = [],
            r = [],
            s = [];
          for (let L = 0; L < e.points.length - 1; L++) {
            const Ae = e.points[L],
              Pe = e.points[L + 1],
              Te = Pe[0] - Ae[0],
              it = Pe[1] - Ae[1],
              dt = Math.hypot(Te, it),
              Ue = Math.ceil(dt / 0.4),
              wt = -it / dt,
              St = Te / dt;
            for (let Nt = 0; Nt < Ue; Nt++) {
              const Mo = Nt / Ue,
                so = (Nt + 1) / Ue,
                no = o.length / 3;
              for (const [Lo, lo] of [
                [Mo, -1],
                [Mo, 1],
                [so, -1],
                [so, 1],
              ]) {
                const Zo = Ae[0] + Te * Lo + wt * e.width * 0.5 * lo,
                  Ht = Ae[1] + it * Lo + St * e.width * 0.5 * lo,
                  $t = Rt(Zo, Ht) + 0.028;
                (o.push(Zo, $t, Ht), r.push(lo * 0.5 + 0.5, Lo * dt * 0.55));
              }
              s.push(no, no + 1, no + 2, no + 1, no + 3, no + 2);
            }
          }
          const u = new a.BufferGeometry();
          (u.setAttribute("position", new a.Float32BufferAttribute(o, 3)),
            u.setAttribute("uv", new a.Float32BufferAttribute(r, 2)),
            u.setIndex(s),
            u.computeVertexNormals());
          const _ = F(u, Cr, e.name, Rn);
          ((_.castShadow = !1), Ar.push(_));
        },
        as = function (e, o, r) {
          const s = Math.max(Rt(e, o), Ai(e, o)) + 0.025,
            u = new a.Group();
          ((u.name = "Poterie_sur_muret"), u.position.set(e, s, o), Rn.add(u));
          const _ = [
            [0.12, 0],
            [0.19, 0.09],
            [0.22, 0.36],
            [0.18, 0.5],
            [0.1, 0.56],
            [0.1, 0.67],
            [0.15, 0.71],
          ].map((Ae) => new a.Vector2(Ae[0] * r, Ae[1] * r));
          F(new a.LatheGeometry(_, 10), xi, "Vase_de_jardin", u);
          const L = F(new a.TorusGeometry(0.135 * r, 0.027 * r, 5, 10), xi, "Rebord_de_poterie", u);
          ((L.rotation.x = Math.PI / 2), (L.position.y = 0.7 * r));
        },
        Ai = function (e, o) {
          let r = -1 / 0;
          for (const s of ja) {
            const u = e - s.x,
              _ = o - s.z;
            Math.abs(u * s.dz - _ * s.dx) < s.width * 0.5 + 0.1 &&
              Math.abs(u * s.dx + _ * s.dz) < s.length * 0.5 + 0.03 &&
              (r = Math.max(r, s.y + 0.1));
          }
          return r;
        },
        Bi = function (e, o) {
          let r = es(e, o) ? q + 3.215 : -1 / 0;
          (ue([e, o], N.forecourt) || ue([e, o], _r)) && (r = q + 0.04);
          for (const s of Sa) {
            const u = e - s.x,
              _ = o - s.z;
            Math.abs(u * s.dz - _ * s.dx) <= s.width * 0.5 + 0.08 &&
              Math.abs(u * s.dx + _ * s.dz) <= s.length * 0.5 + 0.05 &&
              (r = Math.max(r, s.y + 0.025));
          }
          return Math.max(r, Ai(e, o));
        },
        jr = function (e) {
          var r;
          ((Qn = e),
            (r = Uo == null ? void 0 : Uo.setQuality) == null || r.call(Uo, e),
            P == null || P.setQuality(e),
            C == null || C.setQuality(e),
            tr.setQuality(e));
          const o =
            e === "detail"
              ? { ratio: 1.5, shadow: 3072, reflection: 768, fps: 60 }
              : e === "fast"
                ? { ratio: 1, shadow: 1024, reflection: 320, fps: 30 }
                : { ratio: 1.15, shadow: 2048, reflection: 512, fps: 30 };
          ((o.shadow = Math.min(o.shadow, O ? 1024 : 2048)),
            O && (o.ratio = Math.min(o.ratio, 1.15)),
            (Nr = o.fps),
            (In.targetFPS = Nr),
            ($o.shadow.normalBias = e === "fast" ? 0.06 : 0.032),
            globalThis.MoulinV32.render.setQuality(e, o.fps),
            $o.shadow.mapSize.set(o.shadow, o.shadow),
            $o.shadow.map && ($o.shadow.map.dispose(), ($o.shadow.map = null)),
            Yo.forEach((s, u) =>
              s
                .getRenderTarget()
                .setSize(u === 0 ? o.reflection : o.reflection / 2, u === 0 ? o.reflection : o.reflection / 2),
            ),
            Vn.updateLOD(ko.position, Qn, !0),
            Ma.update(ko.position, Qn),
            ho++,
            (xo.shadowMap.needsUpdate = !0),
            (Po = !0),
            (T.querySelector("[data-quality]").value = e));
        },
        ds = function (e) {
          const o = $n[e] || $n.ensemble,
            r = new a.Vector3(...o.position),
            s = new a.Vector3(...o.target);
          if (e !== "ensemble" && e !== "plan") return r;
          const u = new a.PerspectiveCamera(o.fov, ko.aspect, 0.3, 1800);
          for (let _ = 0; _ < 10; _++) {
            (u.position.copy(r), u.lookAt(s), u.updateMatrixWorld(!0));
            let L = 0;
            for (const Ae of [za.min.x, za.max.x])
              for (const Pe of [za.min.y, za.max.y])
                for (const Te of [za.min.z, za.max.z]) {
                  const it = new a.Vector3(Ae, Pe, Te).project(u);
                  L = Math.max(L, Math.abs(it.x), Math.abs(it.y));
                }
            if (L < 0.92) break;
            r.sub(s)
              .multiplyScalar(Math.max(1.025, L / 0.91))
              .add(s);
          }
          return r;
        },
        Nn = function (e, o) {
          var L, Ae;
          if (e < Bt.x0 || e > Bt.x1 || o < Bt.z0 || o > Bt.z1) return 0.2;
          const r = [e, o];
          let s = Math.max(Rt(e, o), Bi(e, o));
          const u = mt(e, o);
          (u.along >= 0 && u.along <= u.length && Math.abs(u.side) < 0.4 && (s = Math.max(s, q + 3.36)),
            ue(r, E) && (s = Math.max(s, q + 0.46)),
            be(e, o, w[2]) <= 0 && (s = Math.max(s, q + N.nicheLocal[1])));
          for (const [Pe, Te] of [
            [0.38, 0],
            [-0.38, 0],
            [0, 0.38],
            [0, -0.38],
          ])
            s = Math.max(s, Rt(e + Pe, o + Te));
          for (const Pe of Re) ue(r, Pe.poly) && (s = Math.max(s, Pe.level));
          for (const Pe of et) ue(r, Pe) && (s = Math.max(s, 0.35));
          for (const Pe of ee) {
            const Te = ge(r, Pe, Pe.maxWidth * 0.5);
            Te.distance < Te.width * 0.5 && (s = Math.max(s, Te.height));
          }
          (ue(r, nn) || ue(r, gn) || ue(r, J)) && (s = Math.max(s, q + 0.08));
          for (const Pe of [
            ...X.featuresV7.footbridges,
            {
              centre: M,
              angle: X.bridge.angleRadians,
              length: X.bridge.length,
              width: X.bridge.width,
              deckLevel: X.bridge.deckLevel,
            },
            {
              centre: He(X.upstreamFootbridge.centre),
              angle: X.upstreamFootbridge.angleRadians,
              length: 3.85,
              width: X.upstreamFootbridge.width,
              deckLevel: X.upstreamFootbridge.deckLevel,
            },
          ]) {
            const Te = e - Pe.centre[0],
              it = o - Pe.centre[1],
              dt = Te * Math.cos(Pe.angle) - it * Math.sin(Pe.angle),
              Ue = Te * Math.sin(Pe.angle) + it * Math.cos(Pe.angle);
            Math.abs(dt) < Pe.length / 2 + 0.15 &&
              Math.abs(Ue) < Pe.width / 2 + 0.1 &&
              (s = Math.max(s, Pe.deckLevel + 0.07));
          }
          const _ = (Ae = (L = Xe.userData).supportHeight23) == null ? void 0 : Ae.call(L, e, o);
          return (Number.isFinite(_) && (s = Math.max(s, _)), s);
        },
        Rr = function (e = !0) {
          const o = X.featuresV7.cameraClearance;
          ((Fo.target.x = a.MathUtils.clamp(Fo.target.x, Bt.x0 - 15, Bt.x1 + 15)),
            (Fo.target.z = a.MathUtils.clamp(Fo.target.z, Bt.z0 - 15, Bt.z1 + 15)),
            (Fo.target.y = Math.max(Fo.target.y, Nn(Fo.target.x, Fo.target.z) + 0.08)));
          let r = Nn(ko.position.x, ko.position.z) + o;
          if (e && Un) {
            const u = ko.position.distanceTo(Un),
              _ = Math.min(2048, Math.ceil(u / 0.35));
            for (let L = 1; L < _; L++) {
              const Ae = L / _,
                Pe = Un.x + (ko.position.x - Un.x) * Ae,
                Te = Un.z + (ko.position.z - Un.z) * Ae,
                it = Nn(Pe, Te) + o;
              r = Math.max(r, (it - Un.y * (1 - Ae)) / Ae);
            }
          }
          const s = ko.position.y < r;
          return (
            s && ((ko.position.y = r), ko.lookAt(Fo.target), (Po = !0)),
            Un ? Un.copy(ko.position) : (Un = ko.position.clone()),
            s
          );
        },
        Oa = function () {
          const e = a.MathUtils.clamp(ko.position.distanceTo(Fo.target) * 0.78, 30, O ? 90 : 128),
            sunVersion32 = globalThis.MoulinV32.sunVersion || 0;
          if (Gi.distanceTo(Fo.target) < 2 && Math.abs(Fi - e) < 3 && Oa.sunVersion32 === sunVersion32) return;
          ((Oa.sunVersion32 = sunVersion32),
            Gi.copy(Fo.target),
            (Fi = e),
            $o.target.position.copy(Fo.target),
            $o.position.copy(Fo.target).add(globalThis.MoulinV32.sunOffset || new a.Vector3(-65, 98, 62)));
          const o = $o.shadow.camera;
          ((o.left = -e),
            (o.right = e),
            (o.top = e),
            (o.bottom = -e),
            o.updateProjectionMatrix(),
            ($o.shadow.normalBias = Qn === "fast" ? 0.06 : e < 80 ? 0.032 : 0.1),
            (xo.shadowMap.needsUpdate = !0));
        },
        Aa = function (e, o = !1) {
          if ((v == null || v.beforeView(), (Wa = e), (Un = null), ho++, e === "oiseaux")) {
            const u = new a.Vector3();
            (wa.birds.forEach((_) => u.add(_.mesh.position)),
              u.multiplyScalar(1 / wa.birds.length),
              ($n.oiseaux = { position: [u.x + 14, 6.2, u.z + 12], target: [u.x, 0.45, u.z], fov: 52 }));
          }
          T.querySelector("[data-view]").value = e;
          const r = $n[e] || $n.ensemble;
          ((_t.visible = !r.cutaway),
            T.querySelector("[data-trees]").setAttribute("aria-pressed", String(_t.visible)),
            (xo.shadowMap.needsUpdate = !0),
            (ko.fov = r.fov),
            ko.updateProjectionMatrix());
          const s = ds(e);
          (o || window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? (ko.position.copy(s), Fo.target.set(...r.target), (Jn = null))
            : (Jn = {
                start: performance.now(),
                from: ko.position.clone(),
                to: s,
                fromTarget: Fo.target.clone(),
                toTarget: new a.Vector3(...r.target),
              }),
            (Fo.minDistance = 1.8),
            (Fo.maxPolarAngle = Math.PI * 0.493),
            Fo.update(),
            Rr(!1),
            Oa(),
            (Po = !0));
        },
        Li = function (e) {
          z == null || z.setMode(typeof e == "string" ? e : e ? "stars" : "day");
        },
        Wr = function () {
          ho++;
          const e = le.getBoundingClientRect();
          (xo.setSize(e.width, e.height, !1),
            (ko.aspect = e.width / e.height),
            ko.updateProjectionMatrix(),
            (v == null ? void 0 : v.mode) === "globe"
              ? Me == null || Me.recenter()
              : (Wa === "ensemble" || Wa === "plan") && Aa(Wa, !0),
            (Po = !0));
        },
        Vi = function () {
          var _, L;
          requestAnimationFrame(Vi);
          const e = performance.now();
          if (document.hidden || !rr) {
            qa = Ua = e;
            return;
          }
          const o = e - qa,
            r = 1e3 / Nr;
          if (o < r - 0.6) return;
          const s = Math.max(0, (e - Ua) / 1e3),
            u = Math.min(0.1, s);
          if (((Ua = e), (qa = e - (o % r)), Jn)) {
            const Ae = Math.min(1, (e - Jn.start) / 1e3),
              Pe = Ae * Ae * (3 - 2 * Ae);
            (ko.position.lerpVectors(Jn.from, Jn.to, Pe),
              Fo.target.lerpVectors(Jn.fromTarget, Jn.toTarget, Pe),
              (Po = !0),
              Ae === 1 && (Jn = null));
          }
          if (
            ((v == null ? void 0 : v.mode) === "play"
              ? k.tick(u)
              : (v == null ? void 0 : v.mode) === "fly"
                ? v.tickFlight(u)
                : (Fo.update(), (v == null ? void 0 : v.mode) !== "globe" && Rr()),
            v == null || v.tick(u),
            ce != null && ce.update(u) && (Po = !0),
            Oa(),
            oa &&
              ((xa += s),
              (ao.value = xa),
              (vr.value = xa),
              wa.update(xa),
              tr.update(xa, u, Math.pow(Math.max(0, ve), 0.52)),
              W.foam.offset.set(0, -xa * 0.11),
              (Po = !0)),
            S.update(xa, u) && (Po = !0),
            (ve = S.wind.value),
            (qe += s),
            x.update(),
            (_ = c == null ? void 0 : c.update) == null || _.call(c, qe, Math.max(0, ve), S.windDirection.value),
            p.update(qe, ve),
            (L = da.update) == null || L.call(da, qe, ve, S.windDirection.value),
            P.update(qe) && oa && (Po = !0),
            ve > 0.001 && ((vr.value = qe), (Po = !0)),
            // V32 : plus de recalcul des ombres pendant le vent (c'etait la cause des saccades).
            C != null && C.update(qe, u) && (Po = !0),
            Uo.update(qe, e) && (Po = !0),
            oa && lt != null && lt.update(qe, u) && (Po = !0),
            Ne == null || Ne.update(qe, u),
            V == null || V.update(),
            z != null && z.update(u, e) && (Po = !0),
            Me != null && Me.update(u, qe) && (Po = !0),
            moulinV32 != null && moulinV32.update(u, qe, e) && (Po = !0),
            In.frames <= Xo.deferredFrames26 && (Po = !0),
            Po)
          ) {
            Po = !1;
            const Ae = performance.now();
            (Vn.updateLOD(ko.position, Qn) && (xo.shadowMap.needsUpdate = !0),
              Ma.update(ko.position, Qn),
              (zo.value =
                !O &&
                (v == null ? void 0 : v.mode) !== "globe" &&
                !(z != null && z.shouldSkipReflection()) &&
                Xo.captures > 0
                  ? 1
                  : 0),
              Xo.frame++,
              (xo.info.autoReset = !1),
              xo.info.reset(),
              (v == null ? void 0 : v.mode) !== "globe" && Eo(),
              (In.reflectionDraws = xo.info.render.calls),
              (In.reflectionTriangles = xo.info.render.triangles),
              xo.render(qn, ko),
              globalThis.MoulinV32.render.frameRendered(performance.now()),
              (In.mainDraws = xo.info.render.calls - In.reflectionDraws),
              (In.mainTriangles = xo.info.render.triangles - In.reflectionTriangles),
              In.frames++,
              (In.draws = xo.info.render.calls),
              (In.triangles = xo.info.render.triangles),
              (In.renderMs = performance.now() - Ae),
              (In.reflections = Xo.captures));
          }
        },
        Ii = function (e) {
          const o = e.map((u) => ({ ...u })),
            r = new Set(o.map((u) => u.id));
          let s = Math.max(95e3, ...o.map((u) => Number(u.id.split("-")[1]) || 0));
          for (const u of yn.garden25.defaultObjects) {
            if (o.length >= 2e3) break;
            if (o.some((L) => Math.hypot(L.x - u.x, L.z - u.z) < 0.7)) continue;
            const _ = { ...u };
            if (r.has(_.id))
              do _.id = "objet-" + ++s;
              while (r.has(_.id));
            (o.push(_), r.add(_.id));
          }
          return o;
        },
        Ni = function (e) {
          const o = e.map((u) => ({ ...u }));
          let r = Math.max(990500, ...o.map((u) => Number(u.id.slice(6)) || 0));
          const s = (u, _, L, Ae = 1, Pe = 0, Te) => {
            o.length >= 2e3 ||
              o.some((it) => Math.hypot(it.x - _, it.z - L) < 0.85) ||
              ae([_, L], 0.08) ||
              fe(_, L) ||
              o.push({
                id: "objet-" + ++r,
                type: u,
                x: _,
                z: L,
                yOffset: 0,
                scale: Ae,
                rotation: Pe,
                variant: r % 4,
                ...(Te ? { color: Te } : {}),
              });
          };
          for (const [u, _, L] of [
            [-6.7, 10.2, "#cc7f91"],
            [1.65, 13.1, "#dfc987"],
            [-5.7, 15.5, "#c5b2da"],
          ])
            s("pot-fleuri", u, _, 1.12, 0, L);
          for (const [u, _] of [
            [-8.3, 9.8],
            [-9.1, 11.2],
            [3.4, 11.9],
            [3.6, 10.5],
          ])
            s("fleurs-sauvages", u, _, 0.85, u * 0.7);
          for (const [u, _] of Re.slice(0, 3).entries())
            for (let L = 4; L < _.poly.length; L += Math.max(5, Math.floor(_.poly.length / 10))) {
              const Ae = _.poly[L],
                Pe = _.poly[(L + 1) % _.poly.length],
                Te = Pe[0] - Ae[0],
                it = Pe[1] - Ae[1],
                dt = Math.hypot(Te, it) || 1;
              let Ue = -it / dt,
                wt = Te / dt;
              const St = (Ae[0] + Pe[0]) / 2,
                Nt = (Ae[1] + Pe[1]) / 2;
              (ue([St + Ue * 0.5, Nt + wt * 0.5], _.poly) && ((Ue = -Ue), (wt = -wt)),
                Rt(St + Ue * 0.7, Nt + wt * 0.7) < _.level + 1 &&
                  s("carex", St + Ue * 0.7, Nt + wt * 0.7, 0.7 + (L % 3) * 0.12, L * 0.43));
            }
          return o;
        },
        fs = function () {
          if (!je || Ri === je.revision) return;
          Ri = je.revision;
          const e = wa,
            o = new Set(),
            r = new Set();
          (e.group.traverse((s) => {
            (s.geometry && o.add(s.geometry), s.material && r.add(s.material));
          }),
            Xe.remove(e.group));
          for (const s of o) s.dispose();
          for (const s of r) s.dispose();
          ((wa = MoulinBirds(a, {
            model: Xe,
            standard: H,
            waterLevel: vt[0].level,
            inside: ue,
            pond: vt[0].poly,
            islands: et,
            terrainHeight: Rt,
            cameraSupportHeight: Nn,
            wetAt: ae,
            foundationFootprints: w,
            footprintDistance: be,
          })),
            Uo == null || Uo.decorate(),
            z == null || z.refreshMaterials());
        },
        Or = function () {
          return (
            Me ||
              (Me = MoulinGlobe26(a, {
                scene: qn,
                model: Xe,
                camera: ko,
                controls: Fo,
                renderer: xo,
                terrainHeight: Rt,
                weather: () => Uo,
                night: () => z,
                ambience: () => S,
                mobile: O,
                markDirty: () => {
                  Po = !0;
                },
              })),
            Me
          );
        },
        Ur = function () {
          const e = (v == null ? void 0 : v.mode) === "globe",
            o = T.querySelector("[data-globe26-bar]");
          o && (o.hidden = !e);
          const r = T.querySelector("[data-globe26-rotate]");
          r &&
            (r.setAttribute("aria-pressed", String(!!Fo.autoRotate)),
            (r.textContent = Fo.autoRotate ? "Pause rotation" : "Faire tourner"));
        };
      const te = globalThis.MoulinBoot || { mobile: !1, step: async () => {} },
        O = te.mobile;
      await te.step("Pr\xE9paration des mati\xE8res\u2026");
      const T = document.getElementById("moulin-vallee-3d");
      T.dataset.mobile = String(O);
      const le = T.querySelector("[data-scene]"),
        X = globalThis.MoulinHost30.plan,
        a = THREE,
        _e = 0.27,
        pe = [1268, 408],
        q = 1.08;
      ((X.bridge.width = 2.65), (X.upstreamFootbridge.width = 2.65));
      for (const e of X.featuresV7.footbridges) e.width = 2.65;
      let v = null,
        k = null,
        h = null,
        b = null,
        p = null,
        S = null,
        x = null,
        c = null,
        P = null,
        C = null,
        Ne = null,
        z = null,
        ce = null,
        V = null,
        Me = null,
        je = null,
        lt = null,
        Ke = null,
        ve = 0.2,
        qe = 0;
      const Xe = new a.Group();
      Xe.name = "Moulin_Saint_Christophe";
      const _t = new a.Group();
      ((_t.name = "Boisements"), Xe.add(_t));
      const Mt = new a.Group();
      ((Mt.name = "Moulin_et_dependance"), Xe.add(Mt));
      let st = 6192026;
      const W = await MoulinSurfaces(a);
      MoulinStyleTextures27(a, W);
      const D = {
          grass: H("#61813f", {
            vertexColors: !0,
            color: 16777215,
            map: W.grass,
            normalMap: W.grassNormal,
            normalScale: new a.Vector2(0, 0),
          }),
          earth: H("#625647"),
          earthLower: H("#354a43"),
          stone: H("#b1ac99", {
            map: W.stone,
            normalMap: W.stoneNormal,
            roughnessMap: W.roughStone,
            metalnessMap: W.roughStone,
          }),
          masonry: H("#a69c88", {
            vertexColors: !0,
            color: 16777215,
            map: W.stone,
            normalMap: W.stoneNormal,
            normalScale: new a.Vector2(0, 0),
            roughnessMap: W.roughStone,
            metalnessMap: W.roughStone,
          }),
          slate: H("#506b88", {
            map: W.slate,
            normalMap: W.slateNormal,
            normalScale: new a.Vector2(0, 0),
            roughness: 0.82,
          }),
          trim: H("#d0ccb4", { map: W.stone, normalMap: W.stoneNormal }),
          wood: H("#b08b60", {
            map: W.wood,
            normalMap: W.woodNormal,
            normalScale: new a.Vector2(0.12, 0.12),
            roughness: 0.98,
          }),
          metal: H("#233b36", { metalness: 0.62, roughness: 0.45 }),
          paving: H("#a6a48c", { map: W.stone, normalMap: W.stoneNormal }),
          glass: H("#718c93", { roughness: 0.12, metalness: 0.3 }),
          tree: H("#597846", { vertexColors: !0, color: 16777215 }),
          trunk: H("#675b43", { vertexColors: !0, color: 16777215, map: W.wood, normalMap: W.woodNormal }),
          foliage: H("#ffffff", { vertexColors: !0, flatShading: !0, roughness: 1, metalness: 0 }),
          canopy: H("#ffffff", { vertexColors: !0, flatShading: !0, roughness: 1, metalness: 0 }),
          waterExport: H("#254c51", {
            metalness: 0.24,
            roughness: 0.22,
            normalMap: W.water,
            normalScale: new a.Vector2(0.23, 0.23),
          }),
          gravel: H("#aaa28a", {
            map: W.gravel,
            normalMap: W.gravelNormal,
            normalScale: new a.Vector2(0.55, 0.55),
            roughness: 1,
          }),
        },
        De = [],
        ke = new Map(),
        rt = [],
        $e = X.featuresV6,
        B = $e.hillWalk,
        G = new a.IcosahedronGeometry(1, 0),
        Qe = new a.IcosahedronGeometry(1, 1);
      (G.computeVertexNormals(), Qe.computeVertexNormals());
      const Fe = new a.CylinderGeometry(0.58, 1, 1, 9, 1),
        Le = new a.Matrix4(),
        pt = new a.Quaternion(),
        Ge = new a.Euler();
      class m {
        constructor(o, r, s) {
          ((this.p = []),
            (this.n = []),
            (this.c = []),
            (this.uv = []),
            (this.idx = []),
            (this.mat = o),
            (this.name = r),
            (this.parent = s));
        }
        add(o, r, s, u, _ = [0, 0, 0]) {
          var Mo, so;
          const L = this.p.length / 3,
            Ae = o.userData.rubbleVariants ? o.userData.rubbleVariants[(L * 13) % o.userData.rubbleVariants.length] : o;
          (pt.setFromEuler(Ge.set(..._)), Le.compose(new a.Vector3(...r), pt, new a.Vector3(...s)));
          const Pe = new a.Matrix3().getNormalMatrix(Le),
            Te = Le.elements,
            it = Pe.elements,
            dt = Ae.attributes.position.array,
            Ue = Ae.attributes.normal.array,
            wt = (Mo = Ae.attributes.uv) == null ? void 0 : Mo.array,
            St = (so = Ae.attributes.color) == null ? void 0 : so.array,
            Nt = typeof u == "string" ? xe(u) : u;
          for (let no = 0; no < dt.length; no += 3) {
            const Lo = dt[no],
              lo = dt[no + 1],
              Zo = dt[no + 2],
              Ht = Ue[no],
              $t = Ue[no + 1],
              to = Ue[no + 2];
            this.p.push(
              Te[0] * Lo + Te[4] * lo + Te[8] * Zo + Te[12],
              Te[1] * Lo + Te[5] * lo + Te[9] * Zo + Te[13],
              Te[2] * Lo + Te[6] * lo + Te[10] * Zo + Te[14],
            );
            const Wo = it[0] * Ht + it[3] * $t + it[6] * to,
              co = it[1] * Ht + it[4] * $t + it[7] * to,
              yo = it[2] * Ht + it[5] * $t + it[8] * to,
              Bo = Math.hypot(Wo, co, yo) || 1;
            (this.n.push(Wo / Bo, co / Bo, yo / Bo),
              this.c.push(Nt.r * (St ? St[no] : 1), Nt.g * (St ? St[no + 1] : 1), Nt.b * (St ? St[no + 2] : 1)));
            const Ho = no / 3;
            this.uv.push(wt ? wt[Ho * 2] : Lo, wt ? wt[Ho * 2 + 1] : Zo);
          }
          if (o.index) for (const no of o.index.array) this.idx.push(L + no);
          else for (let no = 0; no < dt.length / 3; no++) this.idx.push(L + no);
        }
        finish() {
          if (!this.p.length) {
            const s = new a.Group();
            return ((s.name = this.name), this.parent.add(s), s);
          }
          if (this.parent === _t && this.p.length > 3e3) {
            const s = new Map(),
              u = new a.Group();
            ((u.name = this.name), this.parent.add(u));
            for (let _ = 0; _ < this.idx.length; _ += 3) {
              const L = this.idx[_],
                Ae = this.idx[_ + 1],
                Pe = this.idx[_ + 2],
                Te = (this.p[L * 3] + this.p[Ae * 3] + this.p[Pe * 3]) / 3,
                it = (this.p[L * 3 + 2] + this.p[Ae * 3 + 2] + this.p[Pe * 3 + 2]) / 3,
                dt = Math.floor(Te / 36) + ":" + Math.floor(it / 36);
              let Ue = s.get(dt);
              Ue || ((Ue = { p: [], n: [], c: [], uv: [], idx: [], lookup: new Map() }), s.set(dt, Ue));
              for (const wt of [L, Ae, Pe]) {
                let St = Ue.lookup.get(wt);
                if (St === void 0) {
                  ((St = Ue.p.length / 3), Ue.lookup.set(wt, St));
                  for (let Nt = 0; Nt < 3; Nt++)
                    (Ue.p.push(this.p[wt * 3 + Nt]), Ue.n.push(this.n[wt * 3 + Nt]), Ue.c.push(this.c[wt * 3 + Nt]));
                  Ue.uv.push(this.uv[wt * 2], this.uv[wt * 2 + 1]);
                }
                Ue.idx.push(St);
              }
            }
            for (const [_, L] of s) {
              const Ae = new a.BufferGeometry();
              (Ae.setAttribute("position", new a.Float32BufferAttribute(L.p, 3)),
                Ae.setAttribute("normal", new a.Float32BufferAttribute(L.n, 3)),
                Ae.setAttribute("color", new a.Float32BufferAttribute(L.c, 3)),
                Ae.setAttribute("uv", new a.Float32BufferAttribute(L.uv, 2)),
                Ae.setIndex(L.idx),
                Ae.computeBoundingSphere(),
                F(Ae, this.mat, this.name + "_" + _, u));
            }
            return ((this.p = this.n = this.c = this.uv = this.idx = null), u);
          }
          const o = new a.BufferGeometry();
          (o.setAttribute("position", new a.Float32BufferAttribute(this.p, 3)),
            o.setAttribute("normal", new a.Float32BufferAttribute(this.n, 3)),
            o.setAttribute("color", new a.Float32BufferAttribute(this.c, 3)),
            o.setAttribute("uv", new a.Float32BufferAttribute(this.uv, 2)),
            o.setIndex(this.idx));
          const r = F(o, this.mat, this.name, this.parent);
          return (o.computeBoundingSphere(), (this.p = this.n = this.c = this.uv = this.idx = null), r);
        }
      }
      const vt = X.ponds.map((e) => ({ ...e, poly: Ve(e.outline.map(He), 2) })),
        me = X.extraPools.map((e) => ({ ...e, poly: Ve(e.outline.map(He), 2) })),
        Re = [...vt, ...me],
        et = X.islands.map((e) => Ve(e.map(He), 2)),
        kt = X.outlet.centreline.map(He),
        M = He(X.bridge.centre),
        ee = Object.values(X.hydrology).map((e) => ({ ...e, line: e.centreline.map(He) }));
      ee.push({
        name: "Ruisseau_sous_la_passerelle",
        line: kt,
        width: X.outlet.width,
        upstreamLevel: 0,
        downstreamLevel: -0.4,
        bridgeDrop: !0,
      });
      for (const e of ee) {
        ((e.maxWidth = e.widths ? Math.max(...e.widths) : e.width), (e.lengths = [0]));
        for (let o = 1; o < e.line.length; o++)
          e.lengths.push(
            e.lengths[o - 1] + Math.hypot(e.line[o][0] - e.line[o - 1][0], e.line[o][1] - e.line[o - 1][1]),
          );
        e.length = e.lengths[e.lengths.length - 1];
      }
      // V32 : tronçons naturels des cours d'eau (niveau abaissé, berges creusées).
      globalThis.MoulinV32.riverbeds &&
        globalThis.MoulinV32.riverbeds.setup({
          channels: ee,
          ponds: Re,
          inside: ue,
          polyDistance: se,
          cascades: (X.cascades || []).map((e) => ({ centre: He(e.centre), width: e.width })),
        });
      const de = [
          [460, 1248],
          [685, 1040],
          [866, 900],
          [978, 802],
          [1130, 696],
          [1288, 483],
          [1401, 386],
          [1510, 292],
          [1745, 276],
          [1952, 338],
        ].map(He),
        oe = [
          [240, 80],
          [735, 80],
          [895, 182],
          [240, 820],
        ].map(He),
        y = [
          [735, 80],
          [1126, 80],
          [240, 882],
          [240, 820],
          [895, 182],
        ].map(He),
        I = [
          [1540, 775],
          [1640, 735],
          [1718, 792],
          [1850, 827],
          [1908, 946],
          [1908, 1054],
          [1750, 1050],
          [1610, 973],
        ].map(He),
        Be = [
          [925, 1190],
          [1110, 1166],
          [1375, 1150],
          [1533, 1230],
          [1533, 1240],
          [925, 1240],
        ].map(He),
        Se = [
          [],
          [
            [1223, 460],
            [1149, 490],
            [1070, 521],
            [1005, 553],
            [905, 587],
          ].map(He),
          [
            [1478, 587],
            [1555, 640],
            [1505, 739],
            [1420, 827],
            [1371, 901],
            [1300, 978],
            [1194, 1066],
          ].map(He),
        ],
        N = {
          source:
            "IMG_0247\u2013IMG_0267 et photo de terrasse du 24 septembre 2026. Reconstitution par correspondances visuelles ; dimensions non mesur\xE9es.",
          lawns: [
            {
              name: "Pelouse_rive_ouest",
              pixels: [
                [1264, 228],
                [1226, 258],
                [1220, 300],
                [1175, 341],
                [1140, 367],
                [1115, 403],
                [1075, 430],
                [1040, 468],
                [1008, 510],
                [970, 544],
                [935, 576],
                [894, 606],
                [866, 640],
                [826, 674],
                [782, 706],
                [744, 744],
                [718, 780],
                [740, 813],
                [786, 825],
                [838, 788],
                [879, 748],
                [895, 695],
                [942, 655],
                [984, 587],
                [1057, 563],
                [1108, 533],
                [1165, 465],
                [1225, 418],
                [1290, 378],
                [1335, 333],
                [1363, 273],
                [1332, 234],
              ],
              poly: [
                [-31.503, 10.688],
                [-38.179, 16.144],
                [-39.121, 23.64],
                [-47.011, 31.076],
                [-53.164, 35.811],
                [-57.508, 42.297],
                [-64.549, 47.224],
                [-70.667, 54.096],
                [-76.238, 61.671],
                [-82.902, 67.839],
                [-89.038, 73.642],
                [-96.248, 79.108],
                [-101.132, 85.246],
                [-108.152, 91.42],
                [-115.89, 97.251],
                [-122.542, 104.131],
                [-127.063, 110.62],
                [-123.047, 116.429],
                [-114.82, 118.428],
                [-105.672, 111.683],
                [-98.492, 104.437],
                [-95.802, 94.952],
                [-87.554, 87.688],
                [-80.28, 75.454],
                [-67.354, 70.961],
                [-58.363, 65.465],
                [-48.418, 53.186],
                [-37.876, 44.636],
                [-26.422, 37.319],
                [-18.545, 29.17],
                [-13.74, 18.403],
                [-19.377, 11.552],
              ],
            },
            {
              name: "Pelouse_rive_est",
              pixels: [
                [1491, 292],
                [1502, 322],
                [1519, 362],
                [1539, 411],
                [1524, 460],
                [1511, 518],
                [1459, 574],
                [1380, 618],
                [1352, 621],
                [1328, 634],
                [1270, 684],
                [1247, 726],
                [1287, 726],
                [1344, 670],
                [1412, 638],
                [1478, 596],
                [1529, 548],
                [1554, 482],
                [1570, 414],
                [1557, 351],
                [1535, 316],
                [1523, 291],
              ],
              poly: [
                [9.109, 21.401],
                [11.158, 26.709],
                [14.305, 33.781],
                [18.014, 42.445],
                [15.49, 51.215],
                [13.35, 61.582],
                [4.259, 71.71],
                [-9.675, 79.782],
                [-14.652, 80.401],
                [-18.886, 82.788],
                [-29.063, 91.865],
                [-33.032, 99.413],
                [-25.91, 99.292],
                [-15.929, 89.15],
                [-3.917, 83.247],
                [7.709, 75.57],
                [16.645, 66.87],
                [20.898, 55.042],
                [23.543, 42.886],
                [21.038, 31.708],
                [17.016, 25.542],
                [14.804, 21.126],
              ],
            },
            {
              name: "Pelouse_aval",
              pixels: [
                [866, 747],
                [888, 802],
                [971, 849],
                [1068, 864],
                [1159, 833],
                [1193, 798],
                [1217, 773],
                [1249, 797],
                [1204, 847],
                [1133, 887],
                [1042, 903],
                [941, 877],
                [860, 842],
                [814, 821],
              ],
              poly: [
                [-100.81, 104.298],
                [-96.727, 114.025],
                [-81.806, 122.144],
                [-64.49, 124.524],
                [-48.379, 118.73],
                [-42.431, 112.396],
                [-38.232, 107.872],
                [-32.462, 112.049],
                [-40.325, 121.087],
                [-52.846, 128.423],
                [-69.002, 131.546],
                [-87.064, 127.22],
                [-101.592, 121.232],
                [-109.846, 117.631],
              ],
            },
          ],
          trails: [
            {
              name: "Sentier_haut_rive_ouest",
              width: 1.35,
              side: 1,
              points: [
                [-41.129, 16.002],
                [-47.613, 21.224],
                [-54.28, 26.448],
                [-65.144, 31.743],
                [-71.081, 36.955],
                [-78.477, 42.192],
                [-86.969, 47.447],
                [-93.362, 52.667],
                [-102.127, 57.927],
                [-108.52, 63.147],
                [-116.829, 68.399],
                [-125.777, 73.662],
                [-131.714, 78.874],
                [-136.555, 84.068],
                [-144.135, 89.308],
                [-150.801, 94.532],
                [-157.285, 99.753],
                [-163.952, 104.978],
                [-169.706, 110.187],
                [-176.007, 115.405],
                [-182.309, 120.623],
                [-188.428, 125.838],
                [-194.091, 131.046],
                [-198.293, 136.229],
                [-202.587, 141.413],
                [-205.33, 146.571],
              ],
              rise: 1.7,
            },
            {
              name: "Sentier_sous_bois_rive_est",
              width: 1.3,
              side: -1,
              points: [
                [34.646, 38.273],
                [34.914, 43.38],
                [35.731, 48.478],
                [35.635, 53.591],
                [34.078, 58.729],
                [32.705, 63.864],
                [28.776, 69.042],
                [23.752, 74.239],
                [21.648, 79.386],
                [19.544, 84.534],
                [17.44, 89.681],
                [14.242, 94.847],
                [10.495, 100.022],
                [5.106, 105.225],
                [-2.838, 110.471],
                [-9.139, 115.689],
                [-14.711, 120.895],
                [-21.834, 126.127],
                [-29.139, 131.362],
                [-41.829, 136.689],
                [-52.51, 141.981],
                [-58.63, 147.196],
                [-77.159, 152.621],
              ],
              rise: 0.9,
            },
            {
              name: "Montee_vers_la_chaise",
              width: 1.2,
              side: 0,
              points: [
                [-40.588, 15.628],
                [-40, 5],
                [-38, -3],
                [-35.8, -10.8],
              ],
              levels: [5.1, 6.7, 8.7, 10.3],
            },
            {
              name: "Raccord_sentier_cour",
              width: 1.25,
              side: 0,
              points: [
                [-20, 14],
                [-25, 13.5],
                [-33, 13.1],
                [-36.5, 15.7],
                [-41.129, 16.002],
              ],
              levels: [1.08, 1.08, 1.65, 3.65, 5.1],
            },
          ],
          rearWall: [
            [-12.55, 2.95],
            [-10.92, -3.5],
          ],
          rearBed: [
            [-12.14, 2.94],
            [-10.31, 3.48],
            [-8.77, 1.49],
            [-7.84, -1.59],
            [-7.96, -4.69],
            [-6.9, -7.7],
            [-5.9, -10.2],
            [-6.6, -12.8],
            [-7, -15],
            [-8.5, -16.2],
            [-8.7, -14.3],
            [-8.1, -11.5],
            [-9.7, -8.9],
            [-10.1, -6.35],
            [-10.92, -3.5],
            [-12.55, 2.95],
          ],
          nicheLocal: [4.62, 2.34, 3.1],
          nicheLevelNote:
            "Soubassement estime raccorde au terrain haut, niche sous la rive haute du garage; aucune cote altimetrique fournie.",
          rockFace: [
            [-10.92, -3.5],
            [-10.1, -6.35],
            [-9.7, -8.9],
            [-8.1, -11.5],
            [-8.7, -14.3],
            [-8.45, -16.3],
          ],
          upperTerrace: [
            [-30, -0.3],
            [-30, -9],
            [-19, -10],
            [-12, -7],
            [-10.92, -3.5],
            [-12.55, 2.95],
            [-16.14, 2.98],
            [-18.7, 2.82],
            [-26, 2.5],
          ],
          forecourt: [
            [-7.2, -14],
            [-6.2, -9],
            [-4.25, -9.3],
            [-0.9, -12.2],
            [6.4, -10.5],
            [8.8, -17.8],
            [9.6, -22.5],
            [6.6, -25],
            [2.7, -24.8],
            [0.3, -28],
            [-3.2, -28],
            [-5.6, -23.5],
            [-6, -18.5],
          ],
          drive: [
            [2, -88],
            [1, -72],
            [0, -57],
            [-2.3, -43],
            [-3.4, -34],
            [-1.2, -27],
            [-0.5, -23],
          ],
          driveLevels: [4.15, 3.6, 2.94, 2.2, 1.67, 1.25, 1.08],
          stairs: {
            points: [
              [-6.4, -17.3],
              [-7.7, -17.2],
              [-10.95, -16.8],
              [-11.8, -15.2],
              [-12.5, -11.5],
              [-13.2, -8.8],
              [-14, -7.4],
              [-17.6, -8],
              [-18.5, -11.2],
              [-19.5, -16],
              [-21, -19.7],
              [-23.5, -22.6],
              [-25.8, -25],
              [-27.2, -28.2],
              [-29.5, -30.5],
            ],
            levels: [1.08, 1.1, 2.75, 2.9, 3.08, 3.95, 4.28, 4.34, 5.18, 5.5, 6.68, 7.55, 7.74, 8.63, 9.15],
            width: 1.28,
          },
          camellia: { centre: [-9.35, -17], direction: [-0.992, 0.122], clearWidth: 1.34, clearHeight: 2.03 },
          fountain: {
            centre: [-6.9, -13.4],
            angle: 1.42,
            baseLevel: 1.11,
            width: 0.9,
            height: 1.18,
            source: "IMG_0242, petite arche au pied de la rocaille, \xE0 c\xF4t\xE9 du massif de cam\xE9lias",
          },
          cars: [
            { name: "Voiture_grise_sur_la_cour", position: [6.8, -21.2], angle: 1.6, color: "#9aa1a3" },
            { name: "Voiture_sous_le_carport", position: [2.22, -9.23], angle: -0.24, color: "#38464a" },
          ],
          reviewViews: {
            rocaille: { position: [0.4, 3.9, -20.8], target: [-13, 3.55, -4.2], fov: 65 },
            cour: { position: [-1.6, 5.4, -30.5], target: [0.3, 2.4, -13.2], fov: 67 },
            hautmur: { position: [-28.5, 11, -7.5], target: [-5.6, 4.5, 2], fov: 62 },
            escalier: { position: [-3.1, 2.8, -18.6], target: [-11.3, 3.2, -16.3], fov: 54 },
            hydrologie: { position: [48, 234, 30.001], target: [48, 0, 30], fov: 58, cutaway: !0 },
            petitbassin: { position: [-94, 11, 94], target: [-107, -0.05, 113], fov: 55 },
            fontaine: { position: [-2.7, 2.6, -14.7], target: [-7.3, 1.8, -13.5], fov: 49 },
            paliers: { position: [-12.15, 4.8, -12.9], target: [-14.5, 4.55, -6.6], fov: 62 },
            colline: { position: [-1.5, 22, -29], target: [-22, 6, -12], fov: 57 },
            fauteuil: { position: [-39, 12.2, -11.7], target: [-29, 7.5, -1], fov: 64 },
            sousbois: { position: [-25.5, 11.9, -41], target: [-19, 11.2, -60], fov: 66 },
            entree: { position: [-1.9, 5.1, -45.5], target: [-1, 2.7, -17], fov: 62 },
            terrasse: { position: [-9.5, 11, 21.5], target: [-3, 1.8, 11.5], fov: 52 },
            bois: { position: [-94, 6, 100], target: [-103, 1, 106], fov: 56 },
          },
          hydrologyRegistration: {
            worldToMap: [
              [3.0071466985323547, -0.08141245203259473, 999.6900974608266],
              [0.08141245203259473, 3.0071466985323547, 540.9068080227025],
            ],
            biefTracePixels: [
              [1515, 487],
              [1508, 463],
              [1504, 438],
              [1498, 419],
              [1483, 394],
              [1469, 373],
              [1450, 355],
              [1426, 344],
              [1401, 339],
              [1371, 337],
              [1343, 334],
              [1314, 328],
              [1284, 327],
              [1257, 327],
              [1228, 329],
              [1204, 334],
              [1182, 337],
              [1159, 345],
              [1140, 355],
              [1118, 367],
              [1105, 385],
              [1092, 405],
              [1078, 425],
              [1067, 447],
              [1056, 467],
            ],
            riverTracePixels: [
              [1515, 487],
              [1490, 500],
              [1472, 507],
              [1441, 507],
              [1407, 505],
              [1385, 498],
              [1366, 487],
              [1343, 474],
              [1328, 466],
              [1312, 464],
              [1285, 465],
            ],
            notes:
              "Ajustement par moulin, \xEElots et pont ; environ 3 \xE0 5 m de r\xE9sidu. Les raccords au moulin, les \xE9tangs et les ponts restent fixes. Le bras en dehors de la propri\xE9t\xE9 n\u2019est pas prolong\xE9 hors du terrain existant.",
          },
          upperTerraceParts: [
            {
              outer: [
                [-18.7, 2.82],
                [-17.7255, 2.88091],
                [-17.61493, 0.11811],
                [-14.57736, 0.23968],
                [-14.68655, 2.96785],
                [-12.55, 2.95],
                [-10.92, -3.5],
                [-12, -7],
                [-19, -10],
                [-30, -9],
                [-30, -0.3],
                [-26, 2.5],
              ],
              holes: [],
            },
          ],
          hillRoutes: [
            {
              name: "Escaliers_et_paliers_du_jardin",
              points: [
                [-6.4, -17.3],
                [-7.7, -17.2],
                [-10.95, -16.8],
                [-11.8, -15.2],
                [-12.5, -11.5],
                [-13.2, -8.8],
                [-14, -7.4],
                [-17.6, -8],
                [-18.5, -11.2],
                [-19.5, -16],
                [-21, -19.7],
                [-23.5, -22.6],
                [-25.8, -25],
                [-27.2, -28.2],
                [-29.5, -30.5],
              ],
              levels: [1.08, 1.1, 2.75, 2.9, 3.08, 3.95, 4.28, 4.34, 5.18, 5.5, 6.68, 7.55, 7.74, 8.63, 9.15],
              width: 1.28,
              kinds: [
                "landing",
                "steps",
                "landing",
                "path",
                "steps",
                "landing",
                "path",
                "steps",
                "path",
                "steps",
                "steps",
                "path",
                "steps",
                "path",
              ],
              counts: { 1: 8, 4: 5, 7: 5, 9: 7, 10: 5, 12: 5 },
            },
            {
              name: "Sentier_haut_sous_les_arbres",
              points: [
                [-29.5, -30.5],
                [-27, -38],
                [-22, -47],
                [-18, -57],
                [-18.5, -68],
              ],
              levels: [9.15, 9.45, 9.85, 10.35, 10.9],
              width: 2.25,
            },
            {
              name: "Chemin_du_fauteuil_sous_les_pins",
              points: [
                [-29.5, -30.5],
                [-33, -24],
                [-35.4, -16],
                [-35.8, -10.8],
                [-34, -8.4],
              ],
              levels: [9.15, 9.65, 10.2, 10.3, 10.25],
              width: 1.8,
            },
            {
              name: "Bifurcation_entre_les_massifs",
              points: [
                [-11.8, -15.2],
                [-16, -15.4],
                [-20, -18.5],
                [-23.5, -22.6],
              ],
              levels: [2.9, 4.25, 6.3, 7.55],
              width: 1.1,
            },
          ],
          seat: {
            centre: [-34.8, -10.3],
            level: 10.3,
            angle: 1.28,
            source: "IMG_0266, fauteuil tress\xE9 gris sous les pins, tourn\xE9 vers le moulin",
          },
          hillWalls: [
            {
              name: "Muret_massif_au_dessus_du_moulin",
              points: [
                [-13.7, -14],
                [-14.1, -11.6],
                [-14.8, -9.1],
                [-16.2, -8.4],
              ],
              levels: [3.18, 3.48, 4.35, 4.58],
              height: 0.76,
              width: 0.52,
            },
            {
              name: "Muret_palier_des_poteries",
              points: [
                [-16.3, -6.5],
                [-19.2, -7.25],
                [-20.2, -11.2],
                [-21.1, -15.4],
                [-22.2, -18.9],
              ],
              levels: [4.34, 4.5, 5.35, 5.8, 6.65],
              height: 0.65,
              width: 0.53,
            },
            {
              name: "Muret_sous_bois_amont",
              points: [
                [-28.8, -34],
                [-29, -38],
                [-25, -47],
                [-21, -57],
                [-21, -66],
              ],
              levels: [9.4, 9.55, 9.95, 10.5, 10.95],
              height: 0.52,
              width: 0.55,
            },
            {
              name: "Muret_entree_cote_colline",
              points: [
                [-4.9, -43],
                [-5.8, -36],
                [-5.7, -31.6],
                [-4.8, -28.5],
              ],
              levels: null,
              height: 0.64,
              width: 0.52,
            },
            {
              name: "Muret_entree_cote_jardin",
              points: [
                [0.2, -43],
                [-0.9, -36],
                [-0.7, -31.3],
                [0.9, -27.8],
              ],
              levels: null,
              height: 0.58,
              width: 0.5,
            },
          ],
        };
      Se[0] = N.drive;
      const Ie = N.trails,
        E = N.rearBed,
        Y = N.rearWall,
        w = [
          { name: "Moulin", cx: 0, cz: 0, angle: -0.24, u0: -6.3, u1: 4.6, v0: -12.1, v1: 7.55, level: q - 0.025 },
          {
            name: "Dependance",
            cx: -19.44,
            cz: 6.21,
            angle: Math.PI / 2 - 0.04,
            u0: -3.35,
            u1: 3.13,
            v0: -11.65,
            v1: 9.35,
            level: q - 0.025,
          },
          {
            name: "Niche",
            cx: -19.44,
            cz: 6.21,
            angle: Math.PI / 2 - 0.04,
            u0: 3.1,
            u1: 6.2,
            v0: 1.5,
            v1: 4.7,
            level: q + N.nicheLocal[1] - 0.025,
          },
        ],
        Ee = [
          [-19, 6],
          [-13, 4],
          [-6, 5.8],
          [-4, 7],
          [2.05, 7.75],
          [2.6, 8.1],
          [2.3, 11.8],
          [0.8, 16.6],
          [-6.5, 17],
          [-11.5, 17.2],
          [-20, 14.5],
          [-23, 9],
        ],
        bt = [
          [-11.9, -11],
          [-6.4, -9],
          [-5, 5.8],
          [-11.2, 7.2],
        ],
        Bt = { x0: He([240, 0])[0], x1: He([1920, 0])[0], z0: He([0, 80])[1], z1: He([0, 1220])[1] };
      let Rt = yt,
        qt = null;
      async function ro() {
        var lo, Zo;
        const e = [],
          o = [],
          r = [],
          s = [],
          L = [],
          Ae = [],
          Te = [],
          it = [],
          dt = (lo = globalThis.MoulinTerrainCache) == null ? void 0 : lo.call(globalThis);
        for (let Ht = 0; Ht <= 232; Ht++) {
          L[Ht] = [];
          for (let $t = 0; $t <= 340; $t++) {
            let to = Bt.x0 + ((Bt.x1 - Bt.x0) * $t) / 340,
              Wo = Bt.z0 + ((Bt.z1 - Bt.z0) * Ht) / 232;
            L[Ht][$t] = [
              to,
              dt ? (dt.styleVersion === 17 ? dt.grid[Ht * 341 + $t] : Dt(to, Wo, dt.grid[Ht * 341 + $t])) : yt(to, Wo),
              Wo,
            ];
          }
        }
        for (let Ht = 0; Ht < 232; Ht++) {
          Ae[Ht] = [];
          for (let $t = 0; $t < 340; $t++) {
            const to = L[Ht][$t],
              Wo = L[Ht + 1][$t + 1],
              co = [(to[0] + Wo[0]) / 2, (to[2] + Wo[2]) / 2];
            Ae[Ht][$t] = dt
              ? !!dt.mask[Ht * 340 + $t]
              : ee.some((yo) => ((Bo) => Bo.distance < Bo.width / 2 + 4)(ge(co, yo, yo.maxWidth / 2 + 4))) ||
                Re.some((yo) => se(co, yo.poly, !0, 1.6) < 1.6);
          }
        }
        const Ue = new Map();
        // V32 : vrai pendant l'ajout de cellules fines hors du cache de terrain.
        let upgrade32 = !1;
        function wt(Ht, $t, to) {
          const Wo = Ht + ":" + $t;
          if (Ue.has(Wo)) return Ue.get(Wo);
          const co = Bt.x0 + ((Bt.x1 - Bt.x0) * Ht) / (340 * 8),
            yo = Bt.z0 + ((Bt.z1 - Bt.z0) * $t) / 1856,
            Bo = [co, yo],
            Ho = e.length / 3,
            Pn = dt && !upgrade32
              ? dt.styleVersion === 17
                ? dt.heights[Ho]
                : Dt(co, yo, dt.heights[Ho])
              : to === void 0
                ? yt(co, yo)
                : to;
          (e.push(co, upgrade32 || (dt == null ? void 0 : dt.styleVersion) >= 16 ? Pn : ne(co, yo, Pn + Kt(co, yo, Pn)), yo),
            r.push(co * 0.47, yo * 0.47));
          const vn = xe(
              ue(Bo, oe)
                ? "#8cab53"
                : ue(Bo, y)
                  ? "#749536"
                  : ue(Bo, I)
                    ? "#7b9c3f"
                    : ue(Bo, Be)
                      ? "#7f9e42"
                      : "#688c2f",
            ),
            Tn = W.noise(co * 0.19 + 31, yo * 0.15 + 17),
            En = W.noise(co * 0.034, yo * 0.036);
          (vn.multiplyScalar(0.86 + 0.16 * En + 0.065 * W.noise(co * 0.41, yo * 0.36)),
            co > 4 && co < 145 && yo > -48 && yo < 15
              ? (vn.lerp(xe("#91ac43"), Math.max(0, Tn - 0.47) * 0.72),
                vn.multiplyScalar(1 + 0.019 * Math.sin((co * 0.45 + yo * 0.89) * 3.2)))
              : (vn.lerp(xe("#66883b"), Math.max(0, En - 0.5) * 0.34),
                !ue(Bo, oe) &&
                  !ue(Bo, y) &&
                  !ue(Bo, I) &&
                  !ue(Bo, Be) &&
                  (co < -37 || co > 47 || yo > 38 || yo < -54) &&
                  vn.lerp(xe("#68923c"), 0.12 + 0.1 * Tn)));
          const pa = Math.min(339, Math.floor(Ht / 8)),
            aa = Math.min(231, Math.floor($t / 8)),
            _a = Math.hypot(L[aa][pa + 1][1] - L[aa][pa][1], L[aa + 1][pa][1] - L[aa][pa][1]) * 0.46;
          if (
            (_a > 0.45 && vn.lerp(xe("#827762"), Math.min(0.6, (_a - 0.45) * 0.42)),
            co < -10 && co > -46 && yo < -4 && yo > -71)
          ) {
            const Pa = W.noise(co * 0.37, yo * 0.38);
            (vn.lerp(xe(Pa > 0.5 ? "#929269" : "#727d4a"), 0.33),
              N.hillRoutes.slice(1, 3).some((ra) => {
                const Wi = Pt(co, yo, ra);
                return Wi && Wi.d < ra.width * 0.75;
              }) && vn.lerp(xe("#978668"), 0.4));
          }
          we(co, yo) && vn.lerp(xe("#789a3f"), 0.15);
          for (const Pa of Ie) {
            if (!Pa.side) continue;
            const ra = Ct(Bo, Pa, 4);
            ra &&
              ra.d < 4 &&
              ra.signed < 0 &&
              ra.signed > -3.2 &&
              se(Bo, Re[0].poly, !0, 10) > 10 &&
              vn.lerp(xe("#86714f"), 0.22);
          }
          const sr = co * Math.cos(0.24) - yo * Math.sin(0.24),
            lr = co * Math.sin(0.24) + yo * Math.cos(0.24),
            Ca = Math.max(Math.abs(sr) - 4.2, Math.abs(lr) - 7.1);
          return (
            Ca > 0 && Ca < 1.3 && vn.multiplyScalar(0.66 + (0.34 * Ca) / 1.3),
            o.push(vn.r, vn.g, vn.b),
            Ue.set(Wo, Ho),
            Ho
          );
        }
        for (let Ht = 0; Ht < 232; Ht++) {
          Ht % 8 === 0 && (await ((Zo = te.yield) == null ? void 0 : Zo.call(te)));
          for (let $t = 0; $t < 340; $t++) {
            Te[Ht] || (Te[Ht] = []);
            const to = Ae[Ht][$t] ? 8 : 1,
              Wo = 8 / to,
              co = [];
            for (let Bo = 0; Bo <= to; Bo++) {
              co[Bo] = [];
              for (let Ho = 0; Ho <= to; Ho++) {
                let Pn;
                (to === 1
                  ? (Pn = L[Ht + Bo][$t + Ho][1])
                  : Bo === 0 && (Ht === 0 || !Ae[Ht - 1][$t])
                    ? (Pn = L[Ht][$t][1] * (1 - Ho / to) + (L[Ht][$t + 1][1] * Ho) / to)
                    : Bo === to && (Ht === 231 || !Ae[Ht + 1][$t])
                      ? (Pn = L[Ht + 1][$t][1] * (1 - Ho / to) + (L[Ht + 1][$t + 1][1] * Ho) / to)
                      : Ho === 0 && ($t === 0 || !Ae[Ht][$t - 1])
                        ? (Pn = L[Ht][$t][1] * (1 - Bo / to) + (L[Ht + 1][$t][1] * Bo) / to)
                        : Ho === to &&
                          ($t === 339 || !Ae[Ht][$t + 1]) &&
                          (Pn = L[Ht][$t + 1][1] * (1 - Bo / to) + (L[Ht + 1][$t + 1][1] * Bo) / to),
                  (co[Bo][Ho] = wt($t * 8 + Ho * Wo, Ht * 8 + Bo * Wo, Pn)));
              }
            }
            Te[Ht][$t] = { n: to, ids: co };
            const yo = s.length;
            for (let Bo = 0; Bo < to; Bo++)
              for (let Ho = 0; Ho < to; Ho++) {
                const Pn = co[Bo][Ho],
                  vn = co[Bo][Ho + 1],
                  Tn = co[Bo + 1][Ho],
                  En = co[Bo + 1][Ho + 1];
                s.push(Pn, Tn, En, Pn, En, vn);
              }
            it.push({
              x: L[Ht][$t][0],
              z: L[Ht][$t][2],
              start: yo,
              end: s.length,
              coarse: [co[0][0], co[to][0], co[to][to], co[0][0], co[to][to], co[0][to]],
            });
          }
        }
        Rt = function (Ht, $t, to = e) {
          const Wo = a.MathUtils.clamp(((Ht - Bt.x0) / (Bt.x1 - Bt.x0)) * 340, 0, 339.999999),
            co = a.MathUtils.clamp((($t - Bt.z0) / (Bt.z1 - Bt.z0)) * 232, 0, 232 - 1e-6),
            yo = Math.floor(Wo),
            Bo = Math.floor(co),
            Ho = Te[Bo][yo],
            Pn = (Wo - yo) * Ho.n,
            vn = (co - Bo) * Ho.n,
            Tn = Math.min(Ho.n - 1, Math.floor(Pn)),
            En = Math.min(Ho.n - 1, Math.floor(vn)),
            ir = Pn - Tn,
            pa = vn - En,
            aa = (Pa, ra) => to[Ho.ids[ra][Pa] * 3 + 1],
            _a = aa(Tn, En),
            sr = aa(Tn + 1, En),
            lr = aa(Tn + 1, En + 1),
            Ca = aa(Tn, En + 1);
          return pa >= ir ? _a + (Ca - _a) * pa + (lr - Ca) * ir : _a + (sr - _a) * ir + (lr - sr) * pa;
        };
        // V32 : cellules grossières subdivisées (4 × 4) le long des rivières naturelles, pour
        // que les berges creusées aient la finesse voulue. Les nouveaux sommets sont ajoutés
        // après ceux du cache de terrain, dont l'ordre ne change pas.
        const refine32 = globalThis.MoulinV32.riverbeds
          ? globalThis.MoulinV32.riverbeds.cellsToRefine({
              bounds: Bt,
              rows: 232,
              cols: 340,
              channels: ee,
              sample: ge,
              isCoarse: (Ht, $t) => Te[Ht][$t].n === 1,
            })
          : [];
        if (refine32.length) {
          upgrade32 = !0;
          for (const [Ht, $t] of refine32) {
            const cell32 = Te[Ht][$t],
              entry32 = it[Ht * 340 + $t],
              [h00, h01] = [e[cell32.ids[0][0] * 3 + 1], e[cell32.ids[0][1] * 3 + 1]],
              [h10, h11] = [e[cell32.ids[1][0] * 3 + 1], e[cell32.ids[1][1] * 3 + 1]],
              co = [];
            for (let Bo = 0; Bo <= 4; Bo++) {
              co[Bo] = [];
              for (let Ho = 0; Ho <= 4; Ho++) {
                const u = Ho / 4,
                  v = Bo / 4,
                  Pn = v >= u ? h00 + (h10 - h00) * v + (h11 - h10) * u : h00 + (h01 - h00) * u + (h11 - h01) * v;
                co[Bo][Ho] = wt($t * 8 + Ho * 2, Ht * 8 + Bo * 2, Pn);
              }
            }
            for (let yo = entry32.start; yo < entry32.end; yo++) s[yo] = s[entry32.start];
            entry32.start = s.length;
            for (let Bo = 0; Bo < 4; Bo++)
              for (let Ho = 0; Ho < 4; Ho++)
                s.push(co[Bo][Ho], co[Bo + 1][Ho], co[Bo + 1][Ho + 1], co[Bo][Ho], co[Bo + 1][Ho + 1], co[Bo][Ho + 1]);
            entry32.end = s.length;
            Te[Ht][$t] = { n: 4, ids: co };
          }
          upgrade32 = !1;
        }
        // V32 : berges naturelles creusées dans le relief avant de construire le maillage.
        globalThis.MoulinV32.riverbeds &&
          globalThis.MoulinV32.riverbeds.carve({ positions: e, colors: o, sample: ge, channels: ee });
        const St = new a.BufferGeometry();
        (St.setAttribute("position", new a.Float32BufferAttribute(e, 3)),
          St.setAttribute("color", new a.Float32BufferAttribute(o, 3)),
          St.setAttribute("uv", new a.Float32BufferAttribute(r, 2)),
          St.setIndex(s),
          St.computeVertexNormals());
        const Nt = F(St, D.grass, "Relief_estime_de_la_vallee"),
          Mo = new Map();
        // V32 : raccords sans fissure entre cellules de finesses différentes (1, 4 ou 8).
        for (let Ht = 0; Ht < 232; Ht++)
          for (let $t = 0; $t < 340; $t++)
            if (Te[Ht][$t].n > 1) {
              const to = Te[Ht][$t],
                n32 = to.n,
                Wo = [];
              for (const [nb32, edge32] of [
                [Ht > 0 && Te[Ht - 1][$t], (yo) => to.ids[0][yo]],
                [Ht < 231 && Te[Ht + 1][$t], (yo) => to.ids[n32][yo]],
                [$t > 0 && Te[Ht][$t - 1], (yo) => to.ids[yo][0]],
                [$t < 339 && Te[Ht][$t + 1], (yo) => to.ids[yo][n32]],
              ])
                nb32 && nb32.n < n32 && Wo.push([Array.from({ length: n32 + 1 }, (co, yo) => edge32(yo)), n32 / nb32.n]);
              for (const [co, r32] of Wo)
                for (let yo = 1; yo < n32; yo++) {
                  if (yo % r32 === 0) continue;
                  const a32 = Math.floor(yo / r32) * r32;
                  Mo.set(co[yo], [co[yo], co[a32], co[a32 + r32], (yo - a32) / r32]);
                }
            }
        for (const [Ht, $t, to, Wo] of Mo.values())
          ((e[Ht * 3 + 1] = e[$t * 3 + 1] * (1 - Wo) + e[to * 3 + 1] * Wo),
            St.attributes.position.setY(Ht, e[Ht * 3 + 1]));
        (St.computeVertexNormals(),
          (qt = { renderCells: it, values: e, base: Float32Array.from(e), mesh: Nt, constraints: [...Mo.values()] }));
        const so = [
            ...L[0],
            ...L.slice(1).map((Ht) => Ht[340]),
            ...L[232].slice(0, 340).reverse(),
            ...L.slice(1, 232)
              .map((Ht) => Ht[0])
              .reverse(),
          ],
          no = [];
        for (let Ht = 0; Ht < so.length; Ht++) {
          const $t = so[Ht],
            to = so[(Ht + 1) % so.length],
            Wo = [$t[0], -6, $t[2]],
            co = [to[0], -6, to[2]];
          no.push(...$t, ...to, ...co, ...$t, ...co, ...Wo);
        }
        const Lo = new a.BufferGeometry();
        (Lo.setAttribute("position", new a.Float32BufferAttribute(no, 3)),
          Lo.computeVertexNormals(),
          F(
            Lo,
            new a.MeshStandardMaterial({ color: xe("#686553"), roughness: 1, side: a.DoubleSide, flatShading: !0 }),
            "Coupe_du_terrain",
          ),
          g(
            Bt.x1 - Bt.x0,
            0.65,
            Bt.z1 - Bt.z0,
            [(Bt.x0 + Bt.x1) / 2, -6.35, (Bt.z0 + Bt.z1) / 2],
            D.earthLower,
            "Socle",
          ));
      }
      (await te.step("Construction du terrain\u2026"),
        await ro(),
        await te.step("Le moulin et ses \xE9tangs\u2026"),
        Tt(Se[0], 3.1, H("#878b80", { map: W.gravel, roughness: 1 }), "Acces_du_moulin", Rt));
      const Jt = new a.Group();
      ((Jt.name = "Bief_riviere_et_bassins"), Xe.add(Jt));
      const io = [],
        po = [],
        Yo = [],
        ao = { value: 0 },
        wo = { value: 1 },
        zo = { value: 0 },
        Oo = X.waterLayout,
        Q = Oo.atlasBounds,
        Oe = Oo.atlasSize,
        ut = atob(Oo.depth),
        At = new Uint8Array(Oe * Oe * 4),
        It = new Uint8Array(Oe * Oe * 4);
      for (let e = 0; e < ut.length; e++) {
        const o = ut.charCodeAt(e) / 255,
          r = e * 4;
        ((At[r] = At[r + 1] = At[r + 2] = ut.charCodeAt(e)), (At[r + 3] = 255));
        const s = 0.94 + 0.08 * W.noise((e % Oe) * 0.49, Math.floor(e / Oe) * 0.57),
          u = Math.sqrt(o);
        for (let _ = 0; _ < 3; _++) It[r + _] = ([86, 148, 133][_] * (1 - u) + [32, 121, 154][_] * u) * s;
        It[r + 3] = 255;
      }
      // V32 : profondeurs des cours d'eau d'après le relief réel (lits creusés compris).
      globalThis.MoulinV32.riverbeds &&
        globalThis.MoulinV32.riverbeds.bakeDepth({ data: At, size: Oe, bounds: Q, channels: ee, sample: ge, terrain: Rt });
      const Vt = W.fromData(At, Oe, !1, !1),
        Ut = W.fromData(It, Oe, !0, !1);
      (D.waterExport.color.set(16777215),
        (D.waterExport.map = Ut),
        (D.waterExport.roughness = 0.42),
        (D.waterExport.metalness = 0.03),
        (D.waterExport.normalMap = W.waterStatic),
        D.waterExport.normalScale.set(0.55, 0.55));
      const mo = MoulinBedTexture20(a),
        vo = `uniform mat4 reflectionMatrix;attribute vec2 flow;varying vec4 reflectionUv;varying vec3 waterWorld;varying vec2 waterFlow;
 void main(){vec4 world=modelMatrix*vec4(position,1.0);waterWorld=world.xyz;waterFlow=flow;reflectionUv=reflectionMatrix*world;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
        fo = `uniform sampler2D tDiffuse,rippleMap,depthMap,bedMap;
uniform vec4 atlasBounds;
uniform float time,daylight,flowSpeed,waterWind,weatherRain,weatherSnow,weatherFog,planarReflection28;
uniform vec3 weatherFogColor,sunDirection32,sunColor32;
uniform vec2 waterWindDirection;
uniform vec4 turbulence32[6];
varying vec4 reflectionUv;
varying vec3 waterWorld;
varying vec2 waterFlow;
// Optical Fresnel from Clearwater, MIT. The containing project retains its notice.
float waterFresnel(float ci){ci=clamp(ci,0.0,1.0);float ct=sqrt(1.0-(1.0-ci*ci)/(1.333*1.333));float rs=(ci-1.333*ct)/(ci+1.333*ct),rp=(1.333*ci-ct)/(1.333*ci+ct);return .5*(rs*rs+rp*rp);}
float waterHash32(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float waterNoise32(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(waterHash32(i),waterHash32(i+vec2(1.,0.)),f.x),mix(waterHash32(i+vec2(0.,1.)),waterHash32(i+vec2(1.,1.)),f.x),f.y);}
// Reseau de caustiques organique (d'apres le motif libre de joltz0r / Dave Hoskins).
float waterCaustic32(vec2 uv,float t){
 vec2 p=mod(uv*6.2831853,6.2831853)-250.0,i=p;float c=1.0;
 for(int n=0;n<3;n++){float tn=t*(1.0-(3.5/float(n+1)));i=p+vec2(cos(tn-i.x)+sin(tn+i.y),sin(tn-i.y)+cos(tn+i.x));c+=1.0/length(vec2(p.x/(sin(i.x+tn)/.005),p.y/(cos(i.y+tn)/.005)));}
 c/=3.0;c=1.17-pow(c,1.4);return pow(abs(c),8.0);
}
void main(){
 vec3 view=normalize(cameraPosition-waterWorld);float distanceToEye=length(cameraPosition-waterWorld);
 float breeze=clamp(waterWind,0.0,2.0),windWave=pow(breeze,.64),moving=smoothstep(.015,.12,flowSpeed);
 vec2 world=waterWorld.xz,windDir=normalize(waterWindDirection+vec2(.0001)),windCross=vec2(-windDir.y,windDir.x);
 // V32 : le courant du bief et des rivieres (environ 0,5 m/s). Advection en deux phases :
 // les rides suivent le courant sans jamais s'etirer, meme dans les courbes.
 float travel32=time*flowSpeed*2.1;
 float cycle32=fract(travel32*.25);
 float flowBlend32=moving>.001?abs(1.-2.*cycle32):0.;
 vec2 p=world-waterFlow*cycle32*4.;
 vec2 pB32=world-waterFlow*fract(cycle32+.5)*4.+vec2(.47,.29);
 float attenuation=mix(1.0,.42,smoothstep(20.0,150.0,distanceToEye));
 float near=1.-smoothstep(6.,48.,distanceToEye);
 // Trois trains de rides qui se croisent a des vitesses differentes : la surface n'est jamais figee.
 vec2 a=texture2D(rippleMap,p*.11+windDir*time*(.016+.026*windWave)).rg*2.0-1.0;
 vec2 b=texture2D(rippleMap,vec2(p.y,-p.x)*.19+vec2(-time*.019,time*.015)).rg*2.0-1.0;
 vec2 c=texture2D(rippleMap,p*.47+windCross*time*.043-windDir*time*.031).rg*2.0-1.0;
 vec2 ripple32=a*.088+b*.056+c*.034*near;
 if(flowBlend32>.001){
  vec2 aB=texture2D(rippleMap,pB32*.11+windDir*time*(.016+.026*windWave)).rg*2.0-1.0;
  vec2 bB=texture2D(rippleMap,vec2(pB32.y,-pB32.x)*.19+vec2(-time*.019,time*.015)).rg*2.0-1.0;
  vec2 cB=texture2D(rippleMap,pB32*.47+windCross*time*.043-windDir*time*.031).rg*2.0-1.0;
  ripple32=mix(ripple32,aB*.088+bB*.056+cB*.034*near,flowBlend32);
 }
 float broad=dot(p,windDir)*3.1-time*(1.2+windWave*1.3)+sin(dot(p,windCross)*.57-time*.31)*.48;
 float crosswave=dot(p,windCross)*4.7+time*(.75+windWave*.7)+sin(dot(p,windDir)*.42)*.34;
 vec2 slope=ripple32*attenuation*(.6+windWave*.85)
  +(windDir*cos(broad)*(.026+windWave*.062)+windCross*sin(crosswave)*(.015+windWave*.034))*(1.-moving*.75);
 // Courant visible : stries etirees dans le sens de l'ecoulement, remous aux chutes et a la roue.
 float turb32=0.,fleck32=0.,streak32=.5;
 vec2 flowN32=waterFlow/max(length(waterFlow),.001);
 if(moving>.001){
  for(int k=0;k<6;k++){vec4 zone=turbulence32[k];if(zone.w>0.){float dz=length(world-zone.xy);turb32=max(turb32,zone.w*(1.-smoothstep(zone.z*.2,zone.z,dz)));}}
  float sA=0.,sB=0.;
  for(int k=0;k<3;k++){vec2 o=flowN32*float(k)*.32;sA+=waterNoise32((p-o)*2.4);sB+=waterNoise32((pB32-o)*2.4+7.1);}
  streak32=mix(sA,sB,flowBlend32)/3.;
  slope+=vec2(-flowN32.y,flowN32.x)*(streak32-.5)*(.085+.12*turb32)*attenuation;
  float fA=waterNoise32(p*6.8)*waterNoise32(p*2.2+3.7);
  float fB=waterNoise32(pB32*6.8+1.9)*waterNoise32(pB32*2.2+5.3);
  fleck32=mix(fA,fB,flowBlend32);
  vec2 boil32=texture2D(rippleMap,p*.83+vec2(time*.23,-time*.19)).rg*2.-1.;
  slope+=boil32*.1*turb32*attenuation;
 }
 // Risees du vent : des plaques mates et ridees qui glissent sur l'etang.
 float gustPatch=smoothstep(.55,.85,waterNoise32(world*.045-windDir*time*(.12+.18*windWave)))*(1.-moving)*(.35+.65*windWave);
 slope+=c*.05*gustPatch*attenuation;
 float rainRings25=0.;
 if(weatherRain>.001){
  for(int layer25=0;layer25<2;layer25++){
   float scale25=layer25==0?1.15:2.4;
   vec2 cell25=floor(world*scale25),q25=fract(world*scale25);
   float hash25=fract(sin(dot(cell25,vec2(127.1,311.7)))*43758.54);
   vec2 centre25=vec2(.28+.44*hash25,.28+.44*fract(hash25*17.13));
   vec2 local25=q25-centre25;
   float age25=fract(time*(1.10+hash25*.45)+hash25),radius25=length(local25),edge25=abs(radius25-age25*.46);
   float ring25=(1.-smoothstep(.014,.043,edge25))*(1.-age25)*smoothstep(0.,.08,age25);
   slope+=normalize(local25+vec2(.0001))*ring25*.068*weatherRain;
   rainRings25+=ring25*(layer25==0?.17:.09)*weatherRain;
  }
 }
 vec3 normal=normalize(vec3(-slope.x,1.0,-slope.y));float nv=max(dot(view,normal),.03),F=waterFresnel(nv);
 vec2 duv=(world-atlasBounds.xz)/(atlasBounds.yw-atlasBounds.xz);
 // Interpolation adoucie de la carte des profondeurs (1 texel ~ 0,9 m) : pas de quadrillage.
 vec2 depthTexel=duv*${Oe}.0+.5,depthCell=floor(depthTexel),depthFrac=fract(depthTexel);
 depthFrac=depthFrac*depthFrac*(3.-2.*depthFrac);
 float bathymetry=texture2D(depthMap,(depthCell+depthFrac-.5)/${Oe}.0).r;
 bathymetry=clamp(bathymetry+(waterNoise32(world*.9)-.5)*.035,0.,1.);
 float depth=.12+bathymetry*3.4;
 // Eau claire et turquoise : le fond reste visible jusqu'a deux metres environ.
 float shallows=1.-smoothstep(.55,2.7,depth);
 vec3 clearWater=mix(vec3(.028,.30,.29),vec3(.006,.10,.145),smoothstep(.3,3.3,depth));
 // Eau courante : un peu chargee, plus verte et plus sombre que celle des etangs.
 clearWater=mix(clearWater,mix(vec3(.034,.17,.14),vec3(.008,.072,.078),smoothstep(.2,1.3,depth)),moving*.85);
 float depthVariation=sin(world.x*.13+world.y*.09)*sin(world.y*.11-world.x*.05);
 vec3 under=clearWater*(.95+depthVariation*.06)*(.16+.84*daylight);
 if(shallows>.002){
  vec3 refractedRay=refract(-view,normal,1.0/1.333);float opticalPath=depth/max(-refractedRay.y,.26);
  vec2 bottom=world+refractedRay.xz*opticalPath;
  vec3 bed=pow(texture2D(bedMap,bottom*.18).rgb,vec3(2.2))*(.34+.66*daylight);
  bed*=.78+.32*waterNoise32(bottom*.7);
  // Lit de riviere : galets moussus, plus sombres que le fond sableux des etangs.
  bed*=mix(1.,.6+.25*waterNoise32(bottom*2.3),moving);
  vec3 transmission=exp(-mix(vec3(.92,.30,.27),vec3(1.55,.66,.72),moving)*opticalPath);
  float caustic=clamp(waterCaustic32(bottom*.21+slope*.6,time*.42),0.,1.4)*.16*shallows*daylight;
  under=mix(under,bed*transmission*.82+clearWater*(1.-transmission*.66),shallows);
  under+=vec3(.36,.58,.42)*caustic*transmission.g;
 }
 under*=.97+clamp(sin(broad)*.62+cos(crosswave)*.38,-1.,1.)*.04*attenuation;
 // Lumiere qui traverse les vagues face au soleil : lueur turquoise sur les cretes.
 vec3 sunDir=normalize(sunDirection32),halfDir=normalize(view+sunDir);
 float backlit=pow(max(dot(-view.xz,normalize(sunDir.xz+vec2(1e-4))),0.)*.5+.5,3.)*max(0.,sin(broad)*.6+cos(crosswave)*.4);
 under+=vec3(.05,.24,.2)*backlit*.35*daylight*attenuation;
 // A quiet analytical sky survives all camera angles and the mobile path. Planar
 // reflections are restrained to avoid painting enormous cloud photographs on water.
 vec3 reflectedRay=reflect(-view,normal);
 float skyHeight=clamp(reflectedRay.y,0.,1.);
 vec3 sky=mix(vec3(.24,.40,.47),vec3(.33,.52,.68),skyHeight)*(.025+.975*daylight);
 vec3 reflected=sky;
 // Le reflet plan est celui du grand etang : il ne vaut que pour les eaux calmes.
 if(planarReflection28>.5&&moving<.001){
  vec2 projected=reflectionUv.xy/max(reflectionUv.w,.0001)+slope*(.05+.05*(1.0-nv));
  float valid=step(.002,projected.x)*step(.002,projected.y)*step(projected.x,.998)*step(projected.y,.998)*step(0.0,reflectionUv.w);
  vec3 captured=texture2D(tDiffuse,clamp(projected,vec2(.002),vec2(.998))).rgb;
  captured*=mix(vec3(.66,.95,1.0),vec3(1.0),smoothstep(.25,.85,F));
  reflected=mix(sky,captured,valid*(.36+.49*F));
 }
 // Eau courante : a jour frisant, un ruisseau reflete ses berges et sa vegetation, pas le ciel.
 if(moving>.001){
  vec3 banks32=vec3(.03,.055,.028)*(.15+.85*daylight);
  reflected=mix(banks32,reflected,smoothstep(.1,.6,skyHeight)*.85+.15);
 }
 float gloss=mix(140.0,60.0,smoothstep(15.0,120.0,distanceToEye));
 float glint=pow(max(dot(normal,halfDir),0.0),gloss)*.55*daylight/(1.0+distanceToEye*.014);
 // Scintillement du soleil sur les petites rides, qui bouge avec elles.
 vec3 sparkleNormal=normalize(vec3(-(slope.x+c.x*.09),1.0,-(slope.y+c.y*.09)));
 float sparkle=pow(max(dot(sparkleNormal,halfDir),0.0),520.)*2.4*daylight*(1.-gustPatch*.6)*near;
 vec3 colour=mix(under,reflected,min(.66,.04+F*.72))+sunColor32*(glint+sparkle);
 // Blue-green surface ribbons are specular ripples, not foam. White turbulence
 // remains solely at the sluice, flowing channels and the working wheel.
 float crest=pow(max(0.,sin(broad)*.65+cos(crosswave)*.35),10.);
 float broken=.36+.64*smoothstep(-.15,.8,sin(dot(p,windCross)*1.25+time*.34));
 colour+=vec3(.14,.28,.28)*crest*broken*(.11+.11*windWave+.05*moving)*daylight*attenuation;
 colour=mix(colour,colour*vec3(.9,.96,1.)+vec3(.02,.03,.035)*daylight,gustPatch*.5);
 // Liseré d'ecume le long des berges des etangs, qui va et vient doucement.
 float shore=(1.-smoothstep(.13,.36,depth))*(1.-moving);
 float lap=waterNoise32(world*1.6+vec2(time*.11,-time*.08))*.6+waterNoise32(world*4.1-vec2(time*.19,time*.07))*.4;
 float foamBand=shore*smoothstep(.5,.78,lap+.25*sin(time*.9+dot(world,vec2(.7,.4))))*(.35+.65*near);
 colour=mix(colour,vec3(.82,.9,.9)*(.2+.8*daylight),foamBand*.5);
 // Ecume qui derive avec le courant : quelques flocons partout, un tapis blanc dans les remous.
 if(moving>.001){
  float bank32=1.-smoothstep(.16,.55,depth);
  float foamAmount32=smoothstep(.36-.24*turb32-.08*bank32,.46-.2*turb32-.06*bank32,fleck32)*(.3+.7*max(turb32,bank32*.5))*(.55+.9*smoothstep(.45,.7,streak32));
  // Remous : plaques d'ecume bouillonnantes separees par de l'eau sombre.
  float froth32=smoothstep(.76,1.02,streak32*.55+fleck32*1.1+waterNoise32(p*4.1-flowN32*time*.8)*.45);
  foamAmount32=max(foamAmount32,turb32*turb32*froth32*.85);
  colour*=1.-turb32*.18*(1.-froth32);
  colour=mix(colour,vec3(.86,.93,.92)*(.18+.82*daylight),clamp(foamAmount32,0.,1.)*.68*(.45+.55*near));
  colour+=vec3(.07,.11,.11)*(streak32-.5)*daylight*attenuation*(.6+.4*near);
 }
 colour+=vec3(.53,.68,.72)*rainRings25*(.18+.82*daylight)*(1.-smoothstep(36.,120.,distanceToEye));
 colour=mix(colour,weatherFogColor,1.0-exp(-pow(distanceToEye*weatherFog,2.0)));
 float opacity=mix(1.,.8,shallows);opacity=mix(opacity,1.0,min(.8,F));
 gl_FragColor=vec4(colour,opacity);
 #include <tonemapping_fragment>
 #include <encodings_fragment>
}
`;
      let Do = !1,
        ho = 0;
      const Xo = {
          frame: 0,
          captures: 0,
          mode: O ? "analytical-mobile-no-capture" : "camera-synchronised-cache",
          plane: 0,
          deferredFrames26: 2,
        },
        Ko = new a.Vector3(1 / 0, 0, 0),
        ln = new a.Quaternion();
      let jo = -1,
        an = -1;
      for (let e = 0; e < Re.length; e++) {
        const o = Re[e],
          r = new a.Shape(o.poly.map((L) => new a.Vector2(L[0], -L[1]))),
          s = new a.ShapeGeometry(r);
        let u;
        s.setAttribute("flow", new a.Float32BufferAttribute(new Float32Array(s.attributes.position.count * 2), 2));
        const _ = [];
        for (let L = 0; L < s.attributes.position.count; L++)
          _.push(
            (s.attributes.position.getX(L) - Q[0]) / (Q[1] - Q[0]),
            (-s.attributes.position.getY(L) - Q[2]) / (Q[3] - Q[2]),
          );
        (s.setAttribute("uv", new a.Float32BufferAttribute(_, 2)),
          a.ShaderMaterial
            ? (e === 0 && a.Reflector && !O
                ? ((u = new a.Reflector(s, { clipBias: 0.003, textureWidth: 512, textureHeight: 512 })),
                  (u.material.uniforms.reflectionMatrix = { value: new a.Matrix4() }),
                  Object.assign(u.material.uniforms, tn(u, 0)),
                  (u.material.vertexShader = vo),
                  (u.material.fragmentShader = fo),
                  (u.userData.capture = u.onBeforeRender.bind(u)),
                  (u.onBeforeRender = () => {}),
                  Yo.push(u))
                : (u = new a.Mesh(
                    s,
                    new a.ShaderMaterial({ uniforms: tn(Yo[0], 0), vertexShader: vo, fragmentShader: fo }),
                  )),
              po.push(u.material.uniforms),
              Xe.add(u),
              (u.rotation.x = -Math.PI / 2),
              (u.position.y = o.level))
            : (s.rotateX(-Math.PI / 2), eo(s), (u = F(s, D.waterExport, o.name)), (u.position.y = o.level)),
          (u.name = o.name),
          (u.castShadow = !1),
          (u.receiveShadow = !0),
          (u.userData.isWater = !0),
          io.push(u));
      }
      for (const e of ee) {
        const o = Oo.channels[e.name];
        if (!o) throw new Error("Missing clipped water surface " + e.name);
        // V32 : dans les tronçons naturels, l'eau s'étend jusque sous la berge ; c'est le
        // relief qui dessine la ligne d'eau, plus le bord droit de la surface.
        const beds32 = globalThis.MoulinV32.riverbeds,
          widen32 = (dt) => {
            if (!beds32) return dt;
            const Ue = ge(dt, e),
              wt = beds32.natural(e, Ue.along);
            if (wt <= 0.001) return dt;
            const St = beds32.pointAt(e, Ue.along),
              Nt = Math.hypot(dt[0] - St[0], dt[1] - St[1]) || 1;
            return [dt[0] + ((dt[0] - St[0]) / Nt) * 0.5 * wt, dt[1] + ((dt[1] - St[1]) / Nt) * 0.5 * wt];
          };
        const r = o.map((Te) => {
            const it = new a.Shape(Te.outer.map(widen32).map((dt) => new a.Vector2(dt[0], -dt[1])));
            for (const dt of Te.holes) it.holes.push(new a.Path(dt.map((Ue) => new a.Vector2(Ue[0], -Ue[1]))));
            return it;
          }),
          s = new a.ShapeGeometry(r);
        s.rotateX(-Math.PI / 2);
        const u = s.attributes.position,
          _ = [];
        for (let Te = 0; Te < u.count; Te++) {
          const it = ge([u.getX(Te), u.getZ(Te)], e);
          let dt = it.height;
          for (const Ue of Re) {
            const wt = se([u.getX(Te), u.getZ(Te)], Ue.poly, !0, 0.9);
            if (wt < 0.9 && Math.abs(dt - Ue.level) < 0.4) {
              const St = wt / 0.9;
              dt = Ue.level + (dt - Ue.level) * St * St * (3 - 2 * St);
            }
          }
          (u.setY(Te, dt), _.push(...it.flow));
        }
        (s.computeVertexNormals(), eo(s), s.setAttribute("flow", new a.Float32BufferAttribute(_, 2)));
        let L = D.waterExport,
          Ae;
        if (a.ShaderMaterial) {
          Ae = Yo[0];
          const Te = tn(Ae, e.name === "Bief_du_moulin" ? 0.28 : 0.22);
          ((L = new a.ShaderMaterial({ uniforms: Te, vertexShader: vo, fragmentShader: fo })), po.push(Te));
        }
        const Pe = F(s, L, e.name, Jt);
        ((Pe.castShadow = !1), (Pe.userData.isWater = !0), io.push(Pe));
      }
      const To = new a.Group();
      ((To.name = "Iles_du_grand_etang"), Xe.add(To));
      for (let e = 0; e < et.length; e++) {
        const o = et[e],
          r = o.reduce((Pe, Te) => Pe + Te[0], 0) / o.length,
          s = o.reduce((Pe, Te) => Pe + Te[1], 0) / o.length,
          u = o.map((Pe) => [r + (Pe[0] - r) * 0.9, s + (Pe[1] - s) * 0.9]);
        uo(
          u,
          0.35,
          H(e === 0 ? "#74a744" : "#649a3c", {
            map: W.grass,
            normalMap: W.grassNormal,
            normalScale: new a.Vector2(0.5, 0.5),
          }),
          "Ile_" + (e + 1),
          To,
        );
        const _ = [],
          L = [];
        for (let Pe = 0; Pe < 3; Pe++) {
          const Te = [1.025, 0.986, 0.9][Pe],
            it = [-0.2, 0.11, 0.35][Pe];
          for (const dt of o) _.push(r + (dt[0] - r) * Te, it, s + (dt[1] - s) * Te);
        }
        for (let Pe = 0; Pe < 2; Pe++)
          for (let Te = 0; Te < o.length; Te++) {
            const it = (Te + 1) % o.length,
              dt = Pe * o.length + Te,
              Ue = Pe * o.length + it,
              wt = (Pe + 1) * o.length + it,
              St = (Pe + 1) * o.length + Te;
            L.push(dt, Ue, wt, dt, wt, St);
          }
        const Ae = new a.BufferGeometry();
        if (
          (Ae.setAttribute("position", new a.Float32BufferAttribute(_, 3)),
          Ae.setIndex(L),
          Ae.computeVertexNormals(),
          oo(Ae),
          F(
            Ae,
            H("#62953b", { map: W.grass, normalMap: W.grassNormal, side: a.DoubleSide }),
            "Talus_ile_" + (e + 1),
            To,
          ),
          e === 0)
        )
          for (let Pe = 0; Pe < o.length; Pe++) {
            const Te = o[Pe],
              it = o[(Pe + 1) % o.length],
              dt = Math.ceil(Math.hypot(Te[0] - it[0], Te[1] - it[1]) / 1.4),
              Ue = g(
                Math.hypot(Te[0] - it[0], Te[1] - it[1]),
                0.16,
                0.1,
                [(Te[0] + it[0]) / 2, 0.24, (Te[1] + it[1]) / 2],
                D.wood,
                "Platelage_ile",
                To,
              );
            Ue.rotation.y = -Math.atan2(it[1] - Te[1], it[0] - Te[0]);
            for (let wt = 0; wt < dt; wt++) {
              const St = wt / dt;
              g(
                0.12,
                0.55,
                0.12,
                [Te[0] + (it[0] - Te[0]) * St, 0.28, Te[1] + (it[1] - Te[1]) * St],
                D.wood,
                "Piquet_ile",
                To,
              );
            }
          }
      }
      const _o = new a.Group();
      ((_o.name = "Moulin"),
        _o.position.copy(Ce([1268, 408], q)),
        (_o.rotation.y = -0.24),
        Mt.add(_o),
        g(8.4, 6.4, 14.2, [0, 3.2, 0], D.stone, "Murs_du_moulin", _o),
        fn(_o, 9, 15, 6.45, 3.65),
        Vo(_o, -2.05, 1.22, 7.18, 1.3, 2.3, "glazed", 0, "#e3e2d8", !0),
        Vo(_o, 2.05, 1.67, 7.18, 1.2, 1.5, !1, 0, "#e3e2d8", !0),
        Vo(_o, -2.05, 4.9, 7.18, 1.15, 1.54, !1, 0, "#e3e2d8", !0),
        Vo(_o, 2.05, 4.9, 7.18, 1.15, 1.54, !1, 0, "#e3e2d8", !0));
      for (const e of [-4, 1.3])
        (Vo(_o, 4.24, 1.7, e, 1, 1.38, !1, Math.PI / 2), Vo(_o, 4.24, 4.8, e, 1, 1.38, !1, Math.PI / 2));
      for (const e of [-4.4, 0, 4.4])
        (Vo(_o, -4.24, 4.75, e, 1.12, 1.58, !1, -Math.PI / 2),
          e !== 0 && Vo(_o, -4.24, 1.5, e, 1.04, 1.55, !1, -Math.PI / 2));
      Vo(_o, -4.24, 1.22, 0, 1.22, 2.35, !0, -Math.PI / 2);
      for (const e of [-6.2, 6.3]) {
        (g(0.95, 1.8, 0.9, [0, 10.45, e], D.trim, "Cheminee", _o),
          g(1.18, 0.2, 1.12, [0, 11.36, e], D.stone, "Couronnement_cheminee", _o));
        for (let o = -1; o <= 1; o++) g(0.12, 0.25, 0.15, [o * 0.26, 11.58, e], D.slate, "Conduit", _o);
      }
      const Mn = new m(D.masonry, "Maconnerie_de_granit", _o),
        So = new a.BoxGeometry(1, 1, 1),
        ia = new a.Shape([
          new a.Vector2(-0.5, -0.35),
          new a.Vector2(-0.43, -0.49),
          new a.Vector2(0.36, -0.5),
          new a.Vector2(0.5, -0.38),
          new a.Vector2(0.48, 0.37),
          new a.Vector2(0.36, 0.48),
          new a.Vector2(-0.4, 0.5),
          new a.Vector2(-0.5, 0.33),
        ]),
        on = new a.BoxGeometry(1, 1, 1),
        Ro = ["#bab5a1", "#c2bca7", "#b1b1a2", "#b9b6a3", "#c4bca6", "#b6b5a5", "#b3ae99", "#c7c0ad"];
      for (let e = 0; e < 14; e++) {
        const o = 0.22 + e * 0.445;
        let r = -4.17;
        for (; r < 4.1; ) {
          const s = Math.min(U(0.56, 1.1), 4.2 - r),
            u = r + s / 2;
          ((Math.abs(u + 2.05) < 0.83 && (o < 2.55 || Math.abs(o - 4.9) < 0.94)) ||
            (Math.abs(u - 2.05) < 0.79 && (Math.abs(o - 1.65) < 0.9 || Math.abs(o - 4.9) < 0.9)) ||
            Mn.add(
              on,
              [u, o + U(-0.013, 0.013), 7.125],
              [s - 0.014, U(0.421, 0.435), U(0.055, 0.095)],
              Ro[Math.floor($() * Ro.length)],
              [0, 0, U(-0.025, 0.025)],
            ),
            Mn.add(on, [u, o + U(-0.01, 0.01), -7.135], [s - 0.014, 0.428, 0.062], Ro[Math.floor($() * Ro.length)], [
              0,
              0,
              U(-0.02, 0.02),
            ]),
            (r += s));
        }
        for (const s of [-1, 1]) {
          let u = -7.08;
          for (; u < 7.05; ) {
            const _ = Math.min(U(0.56, 1.08), 7.1 - u),
              L = u + _ / 2;
            ((s === 1
              ? [-4, 1.3].some((Pe) => Math.abs(L - Pe) < 0.73) &&
                (Math.abs(o - 1.7) < 0.85 || Math.abs(o - 4.8) < 0.86)
              : ([-4.4, 0, 4.4].some((Pe) => Math.abs(L - Pe) < 0.77) && Math.abs(o - 4.75) < 0.94) ||
                ([-4.4, 4.4].some((Pe) => Math.abs(L - Pe) < 0.74) && Math.abs(o - 1.5) < 0.92) ||
                (Math.abs(L) < 0.8 && o < 2.6)) ||
              Mn.add(
                on,
                [s * 4.225, o + U(-0.012, 0.012), L],
                [_ - 0.014, U(0.421, 0.435), 0.082],
                Ro[Math.floor($() * Ro.length)],
                [0, (s * Math.PI) / 2, U(-0.018, 0.018)],
              ),
              (u += _));
          }
        }
      }
      for (let e = 0; e < 10; e++) {
        const o = 6.63 + e * 0.345,
          r = 4.1 * (1 - (o - 6.45) / 3.55);
        if (!(r < 0.2))
          for (let s = -r; s < r; ) {
            const u = Math.min(U(0.55, 0.94), r - s);
            for (const _ of [-1, 1])
              Mn.add(
                on,
                [s + u / 2, o, _ * 7.235],
                [Math.max(0.035, u - 0.015), 0.329, 0.055],
                Ro[Math.floor($() * Ro.length)],
              );
            s += u;
          }
      }
      Mn.finish();
      for (const e of [-4.4, 0, 4.4]) {
        const o = new a.Group();
        ((o.name = "Lucarne_facade_cour"),
          o.position.set(-3.65, 6.22, e),
          (o.rotation.y = -Math.PI / 2),
          _o.add(o),
          g(1.5, 2.05, 1.65, [0, 1.025, 0], D.stone, "Jouees_lucarne", o),
          fn(o, 1.92, 1.92, 2.06, 0.74),
          Vo(o, 0, 1.08, 0.865, 0.86, 1.4));
      }
      const cn = new a.BufferGeometry();
      (cn.setAttribute(
        "position",
        new a.Float32BufferAttribute(
          [
            -4.2, 3.63, 0, -6.04, 2.47, -1.26, -4.2, 2.47, -1.26, -4.2, 3.63, 0, -6.04, 2.47, 1.26, -6.04, 2.47, -1.26,
            -4.2, 3.63, 0, -4.2, 2.47, 1.26, -6.04, 2.47, 1.26,
          ],
          3,
        ),
      ),
        cn.computeVertexNormals(),
        F(
          cn,
          new a.MeshStandardMaterial({ color: xe("#3e4953"), side: a.DoubleSide, roughness: 0.8 }),
          "Auvent_entree_du_moulin",
          _o,
        ));
      const wn = new a.Group();
      ((wn.name = "Abri_accole_arriere_moulin"),
        _o.add(wn),
        Dn(
          wn,
          [
            [-3.6, 3.7, -7.18],
            [3.6, 3.7, -7.18],
            [3.6, 2.45, -11.7],
            [-3.6, 2.45, -11.7],
          ],
          "Toit_abri_voiture",
        ));
      for (const e of [-3.45, 3.45])
        (g(0.22, 2.5, 0.22, [e, 1.25, -11.4], D.wood, "Poteau_abri", wn),
          Io([e, 1.75, -11.4], [e, 2.65, -10.45], 0.14, 0.14, D.wood, "Contreventement_abri", wn));
      g(7.1, 0.22, 0.2, [0, 2.46, -11.4], D.wood, "Poutre_abri", wn);
      const No = new a.Group();
      ((No.name = "Veranda_cote_deuxieme_etang"), _o.add(No));
      const rn = H("#d8d7bf", { roughness: 0.54, metalness: 0.17 }),
        Bn = H("#aac3bd", {
          transparent: !0,
          opacity: 0.24,
          roughness: 0.12,
          metalness: 0.22,
          side: a.DoubleSide,
          depthWrite: !1,
        });
      g(3.45, 0.18, 7.9, [5.92, 0.04, -0.3], D.paving, "Sol_veranda", No);
      for (const e of [-4.15, 3.55])
        (g(0.09, 2.75, 0.09, [4.3, 1.4, e], rn, "Montant_veranda", No),
          g(0.095, 2.05, 0.095, [7.56, 1.06, e], rn, "Montant_veranda", No),
          g(3.28, 1.85, 0.023, [5.93, 1.02, e], Bn, "Vitre_laterale_veranda", No),
          Io([4.3, 2.78, e], [7.56, 2.08, e], 0.08, 0.085, rn, "Traverse_toit_veranda", No),
          g(3.35, 0.075, 0.09, [5.93, 0.17, e], rn, "Lisse_basse_veranda", No));
      for (let e = 0; e <= 5; e++) {
        const o = -4.15 + (e * 7.7) / 5;
        (g(0.095, 2.05, 0.085, [7.56, 1.06, o], rn, "Montant_vitrage", No),
          Io([4.3, 2.78, o], [7.56, 2.08, o], 0.065, 0.07, rn, "Chevron_veranda", No));
      }
      for (let e = 0; e < 5; e++) {
        const o = -4.15 + ((e + 0.5) * 7.7) / 5;
        g(0.022, 1.83, 1.48, [7.57, 1.05, o], Bn, "Baie_vitree_veranda", No);
      }
      for (const e of [0.17, 2.06]) g(0.09, 0.075, 7.8, [7.56, e, -0.3], rn, "Traverse_facade_veranda", No);
      const mn = new a.BufferGeometry();
      (mn.setAttribute(
        "position",
        new a.Float32BufferAttribute(
          [4.3, 2.79, -4.15, 7.56, 2.09, -4.15, 7.56, 2.09, 3.55, 4.3, 2.79, -4.15, 7.56, 2.09, 3.55, 4.3, 2.79, 3.55],
          3,
        ),
      ),
        mn.computeVertexNormals(),
        F(mn, Bn, "Toit_vitre_veranda", No));
      for (const e of [-4.15, 3.55]) {
        const o = new a.BufferGeometry();
        (o.setAttribute("position", new a.Float32BufferAttribute([4.3, 2.05, e, 7.56, 2.05, e, 4.3, 2.78, e], 3)),
          o.computeVertexNormals(),
          F(o, Bn, "Triangle_vitre_veranda", No),
          g(3.28, 0.065, 0.07, [5.93, 2.05, e], rn, "Traverse_haute_laterale", No));
      }
      (F(new a.CylinderGeometry(0.65, 0.65, 0.07, 32), H("#bba778"), "Table_ronde_veranda", No).position.set(
        5.9,
        0.76,
        -0.35,
      ),
        F(new a.CylinderGeometry(0.1, 0.22, 0.71, 16), D.metal, "Pied_table_ronde", No).position.set(5.9, 0.36, -0.35),
        g(0.7, 0.32, 2.1, [4.85, 0.4, 0.4], H("#c5c7bc"), "Canape_veranda", No),
        g(0.2, 0.66, 2.1, [4.45, 0.67, 0.4], H("#c5c7bc"), "Dossier_canape_veranda", No),
        No.scale.set(0.82, 1, 0.74),
        No.position.set(4.3 * 0.18, 0, -0.65));
      const sn = new a.Group();
      ((sn.name = "Lucarne_cote_veranda"),
        sn.position.set(3.65, 6.22, -0.65),
        (sn.rotation.y = Math.PI / 2),
        _o.add(sn),
        g(1.48, 2.05, 1.6, [0, 1.025, 0], D.stone, "Pierre_lucarne_est", sn),
        fn(sn, 1.88, 1.9, 2.06, 0.72),
        Vo(sn, 0, 1.08, 0.84, 0.84, 1.4));
      const Qo = new a.Group();
      ((Qo.name = "Dependance"),
        Qo.position.copy(Ce([1196, 431], q)),
        (Qo.rotation.y = Math.PI / 2 - 0.04),
        Mt.add(Qo));
      const un = new a.Group();
      ((un.name = "Dependance_corps_arriere"),
        un.position.set(0, 0.15, -3.7),
        Qo.add(un),
        g(6.3, 3.65, 8, [0, 1.825, 0], D.stone, "Murs_corps_arriere", un),
        fn(un, 6.9, 8.6, 3.7, 2.5));
      const Go = new a.Group();
      ((Go.name = "Dependance_aile_toit_un_pan"),
        Qo.add(Go),
        g(0.32, 3.45, 6.7, [2.99, 1.725, 3.65], D.stone, "Mur_arriere_du_garage", Go));
      for (const e of [0.46, 6.84]) g(6.3, 3.45, 0.32, [0, 1.725, e], D.stone, "Mur_lateral_du_garage", Go);
      (g(0.32, 3.45, 3, [-2.99, 1.725, 1.8], D.stone, "Trumeau_garage_gauche", Go),
        g(0.32, 3.45, 0.6, [-2.99, 1.725, 6.7], D.stone, "Trumeau_garage_droit", Go),
        g(0.32, 0.91, 3.1, [-2.99, 2.995, 4.85], D.stone, "Linteau_garage", Go),
        g(5.95, 0.12, 6.35, [0, 0.03, 3.65], D.earth, "Sol_interieur_garage", Go));
      const kn = (e) => 3.6 + ((e + 3.15) / 6.3) * 1.68;
      for (const e of [0.3, 7]) {
        const o = new a.BufferGeometry();
        o.setAttribute(
          "position",
          new a.Float32BufferAttribute(
            [-3.15, 3.43, e, 3.15, 3.43, e, 3.15, 5.28, e, -3.15, 3.43, e, 3.15, 5.28, e, -3.15, 3.6, e],
            3,
          ),
        );
        const r = [];
        for (let s = 0; s < o.attributes.position.count; s++)
          r.push(o.attributes.position.getX(s), o.attributes.position.getY(s));
        (o.setAttribute("uv", new a.Float32BufferAttribute(r, 2)),
          o.computeVertexNormals(),
          F(o, H("#b2a791", { map: W.stone, side: a.DoubleSide }), "Pignon_asymetrique_dependance", Go));
      }
      (g(0.14, 1.84, 6.7, [3.09, 4.35, 3.65], D.stone, "Mur_haut_aile_dependance", Go),
        Dn(
          Go,
          [
            [-3.45, 3.62, 0.05],
            [3.45, 5.46, 0.05],
            [3.45, 5.46, 7.28],
            [-3.45, 3.62, 7.28],
          ],
          "Ardoises_aile_un_pan",
        ),
        g(0.15, 0.14, 7.25, [3.43, 5.5, 3.67], H("#8c7262"), "Rive_haute_tuiles", Go),
        g(0.65, 1.15, 0.75, [0, 6.74, -6.9], D.trim, "Cheminee_dependance", Qo));
      const xn = new m(D.masonry, "Pierres_dependance", Qo);
      for (const e of [-1, 1])
        for (let o = -7.68; o < 7; ) {
          const r = Math.min(U(0.55, 0.98), 7 - o),
            s = o + r / 2,
            u = s < 0.3 ? 3.8 : kn(e * 3.15);
          for (let _ = 0.17; _ < u - 0.04; _ += 0.33)
            (e === -1 &&
              ((Math.abs(s - 4.85) < 1.64 && _ < 2.56) ||
                (Math.abs(s + 4.04) < 0.57 && _ < 2.46) ||
                ([-6, -2].some((Ae) => Math.abs(s - Ae) < 0.5) && Math.abs(_ - 1.53) < 0.72))) ||
              xn.add(on, [e * 3.175, _, s], [r - 0.015, 0.31, 0.074], Ro[Math.floor($() * Ro.length)], [
                0,
                (e * Math.PI) / 2,
                0,
              ]);
          o += r;
        }
      for (let e = 0.17; e < 5.28; e += 0.33)
        for (let o = -3.14; o < 3.14; ) {
          const r = Math.min(U(0.55, 1.02), 3.14 - o);
          (e < kn(o + r / 2) - 0.04 &&
            xn.add(
              on,
              [o + r / 2, e, 7.035],
              [Math.max(0.03, r - 0.015), 0.31, 0.075],
              Ro[Math.floor($() * Ro.length)],
            ),
            (o += r));
        }
      for (const e of [-7.73, 0.32])
        for (let o = 3.83; o < 6.3; o += 0.33) {
          const r = 3.13 * (1 - (o - 3.8) / 2.5);
          for (let s = -r; s < r; ) {
            const u = Math.min(U(0.56, 1.04), r - s);
            (xn.add(on, [s + u / 2, o, e], [Math.max(0.03, u - 0.015), 0.31, 0.074], Ro[Math.floor($() * Ro.length)]),
              (s += u));
          }
        }
      xn.finish();
      const hn = new a.Group();
      ((hn.name = "Appentis_contre_le_pignon"),
        Qo.add(hn),
        Dn(
          hn,
          [
            [-3.34, 2.82, 6.8],
            [3.34, 2.82, 6.8],
            [3.34, 2.23, 9.08],
            [-3.34, 2.23, 9.08],
          ],
          "Ardoises_appentis",
        ));
      for (const e of [-2.94, 2.94])
        (g(0.18, 2.3, 0.18, [e, 1.15, 8.86], D.wood, "Poteau_appentis", hn),
          Io([e, 1.56, 8.86], [e, 2.35, 8.03], 0.12, 0.12, D.wood, "Echarpe_appentis", hn));
      g(6.15, 0.18, 0.16, [0, 2.21, 8.86], D.wood, "Poutre_appentis", hn);
      for (let e = 0; e < 7; e++)
        g(U(0.9, 1.8), 0.12, 0.2, [U(-1, 1), 0.22 + e * 0.12, 7.3 + U(-0.15, 0.15)], D.wood, "Bois_range", hn);
      const Gn = new a.Group();
      ((Gn.name = "Petite_aile_gauche_de_la_dependance"),
        Qo.add(Gn),
        g(6.18, 2.22, 3.55, [0, 1.11, -9.45], D.stone, "Murs_aile_gauche", Gn));
      for (const e of [-1, 1]) {
        const o = new a.BufferGeometry();
        (o.setAttribute(
          "position",
          new a.Float32BufferAttribute([e * 3.1, 2.2, -11.22, e * 3.1, 2.2, -7.68, e * 3.1, 3.5, -7.68], 3),
        ),
          o.computeVertexNormals(),
          F(o, H("#a39e8b", { map: W.stone, side: a.DoubleSide }), "Pignon_incline_aile_gauche", Gn));
      }
      (Dn(
        Gn,
        [
          [-3.38, 2.27, -11.47],
          [3.35, 2.27, -11.47],
          [3.35, 3.57, -7.6],
          [-3.38, 3.57, -7.6],
        ],
        "Toiture_aile_gauche",
      ),
        Vo(Gn, -3.17, 1.22, -9.54, 0.88, 2.16, "glazed", -Math.PI / 2, "#4c4637", !1));
      const dn = new m(D.masonry, "Pierres_aile_gauche", Gn);
      for (let e = 0; e < 11; e++) {
        const o = 0.16 + e * 0.315;
        for (let r = -11.18; r < -7.68; ) {
          const s = Math.min(U(0.55, 0.96), -7.68 - r),
            u = r + s / 2,
            _ = 2.22 + ((u + 11.22) / 3.54) * 1.28;
          (o < _ - 0.03 &&
            !(Math.abs(u + 9.54) < 0.6 && o < 2.46) &&
            dn.add(on, [-3.16, o, u], [s - 0.013, 0.295, 0.077], Ro[Math.floor($() * Ro.length)], [0, -Math.PI / 2, 0]),
            (r += s));
        }
        if (o < 2.24)
          for (let r = -3.08; r < 3.05; r += 0.76)
            dn.add(on, [r + 0.35, o, -11.24], [0.74, 0.295, 0.075], Ro[(e + Math.round(r * 4) + 60) % Ro.length]);
      }
      dn.finish();
      const _n = new a.Group();
      ((_n.name = "Garage_portes_ouvertes"), (_n.userData.dynamic25 = !0), Qo.add(_n));
      const zn = H("#527964", { roughness: 0.92 }),
        An = H("#21251f", { roughness: 1 });
      g(0.055, 2.48, 3.1, [-0.5, 1.25, 4.85], An, "Ouverture_du_garage", _n);
      for (const e of [-1, 1]) {
        const o = new a.Group();
        ((o.name = "Vantail_garage_ouvert"),
          o.position.set(-3.28, 0, 4.85 + e * 1.55),
          (o.rotation.y = e * 0.97),
          _n.add(o));
        const r = -e * 0.775;
        g(0.075, 2.4, 1.54, [0, 1.23, r], zn, "Panneau_du_vantail", o);
        for (let s = 0; s < 10; s++) g(0.018, 2.38, 0.13, [-0.047, 1.23, r - 0.69 + s * 0.153], zn, "Lame_de_porte", o);
        for (const s of [0.46, 1.88]) g(0.09, 0.085, 1.45, [-0.065, s, r], D.metal, "Ferrure_de_porte", o);
      }
      const Xn = H("#55483a", { map: W.wood });
      for (const e of [-5.8, -1.7]) {
        const o = new a.Group();
        ((o.name = "Lucarne_bois_dependance"),
          o.position.set(-2.68, 3.15, e),
          (o.rotation.y = -Math.PI / 2),
          Qo.add(o),
          g(1.12, 2.02, 1.5, [0, 1, 0], Xn, "Jouees_bois_lucarne", o),
          fn(o, 1.22, 1.65, 2, 0.57),
          Vo(o, 0, 1, 0.79, 0.57, 1.64, !1, 0, "#383831").traverse((s) => {
            ["Jambage_granit", "Linteau_pierre", "Seuil_pierre", "Appui"].includes(s.name) && (s.material = Xn);
          }),
          o.traverse((s) => {
            s.name === "Pignon_granit" && (s.material = Xn);
          }));
      }
      for (const e of [-6, -2]) Vo(Qo, -3.22, 1.53, e, 0.68, 1.12, !1, -Math.PI / 2, "#383831");
      Vo(Qo, -3.225, 1.19, -4.04, 0.86, 2.24, "glazed", -Math.PI / 2, "#383831");
      for (let e = 0; e < 3; e++)
        g(
          0.31,
          0.47 - e * 0.16,
          1.16,
          [-3.48 - e * 0.31, (0.47 - e * 0.16) / 2, -4.04],
          D.stone,
          "Marche_entree_dependance",
          Qo,
        );
      F(new a.CylinderGeometry(0.1, 0.1, 1.3, 16), D.metal, "Conduit_metal_dependance", Qo).position.set(
        -1.7,
        5.7,
        -6.45,
      );
      const nn = [
        [-19, 6],
        [-13, 4],
        [-6, 5.8],
        [-4, 7],
        [2.05, 7.75],
        [2.6, 8.1],
        [2.3, 11.8],
        [0.8, 16.6],
        [-6.5, 17],
        [-11.5, 17.2],
        [-20, 14.5],
        [-23, 9],
      ];
      (uo(nn, q + 0.03, D.gravel, "Cour_en_gravier", Mt),
        uo(
          [
            [-11.9, -11],
            [-6.4, -9],
            [-5, 5.8],
            [-11.2, 7.2],
          ],
          q + 0.04,
          D.gravel,
          "Passage_cour",
          Mt,
        ));
      const gn = [
        [-7.4, 7.9],
        [2.05, 7.75],
        [2.6, 8.1],
        [2.3, 11.8],
        [0.8, 16.5],
        [-6.2, 16.9],
      ];
      uo(gn, q + 0.055, D.paving, "Terrasse_du_moulin", Mt);
      const ea = new m(H("#b0aa96", { vertexColors: !0, color: 16777215, map: W.stone }), "Dalles_de_la_terrasse", Mt);
      for (let e = -7.2; e < 6; e += 1.18)
        for (let o = 7; o < 20; o += 0.92)
          ue([e, o], gn) &&
            ue([e + 0.55, o + 0.43], gn) &&
            ue([e - 0.55, o - 0.43], gn) &&
            ea.add(So, [e, q + 0.075, o], [1.145, 0.025, 0.88], xe("#b5af9b").multiplyScalar(U(0.85, 1.1)));
      (ea.finish(),
        Tt(
          [
            [-19.5, 14.4],
            [-11.5, 16.65],
            [-6.2, 16.6],
            [0.7, 16.35],
          ],
          0.75,
          D.paving,
          "Bande_dallee_bord_de_l_eau",
          () => q + 0.025,
          Mt,
        ));
      const Sn = new a.Group();
      ((Sn.name = "Bief_maconne_de_la_terrasse"), Mt.add(Sn));
      const Jo = new m(D.masonry, "Pierres_et_couvertines_du_bief", Sn),
        Cn = ee.find((e) => e.name === "Bief_du_moulin"),
        Zn = Cn.line.slice(-3),
        f = Cn.widths.slice(-3);
      for (const e of [-1, 1]) {
        const o = Zn.map((r, s) => {
          const u = Zn[Math.max(0, s - 1)],
            _ = Zn[Math.min(Zn.length - 1, s + 1)],
            L = _[0] - u[0],
            Ae = _[1] - u[1],
            Pe = Math.hypot(L, Ae),
            Te = f[s] / 2 + 0.22;
          return [r[0] - (Ae / Pe) * Te * e, r[1] + (L / Pe) * Te * e];
        });
        for (let r = 0; r < o.length - 1; r++) {
          const s = o[r],
            u = o[r + 1],
            _ = u[0] - s[0],
            L = u[1] - s[1],
            Ae = Math.hypot(_, L),
            Pe = -Math.atan2(L, _),
            Te = g(
              Ae + 0.08,
              q + 0.04,
              0.44,
              [(s[0] + u[0]) / 2, (q + 0.04) / 2, (s[1] + u[1]) / 2],
              D.stone,
              "Paroi_evasee_du_bief",
              Sn,
            );
          Te.rotation.y = Pe;
          for (let it = 0.2; it < Ae; it += 0.4) {
            const dt = s[0] + (_ * it) / Ae,
              Ue = s[1] + (L * it) / Ae;
            for (let wt = 0; wt < 6; wt++)
              Jo.add(on, [dt, 0.12 + wt * 0.169, Ue], [0.39, 0.148, 0.465], Ro[Math.floor($() * Ro.length)], [
                0,
                Pe,
                0,
              ]);
            Jo.add(So, [dt, q + 0.075, Ue], [0.395, 0.09, 0.55], xe("#a8a591").multiplyScalar(U(0.88, 1.12)), [
              0,
              Pe,
              0,
            ]);
          }
        }
      }
      Jo.finish();
      const J = [
        [4.16, 8.15],
        [9, 6.5],
        [15.8, 8.8],
        [16.9, 12],
        [15.9, 14.45],
        [9.1, 16.3],
        [5.55, 17],
        [5.3, 12],
      ];
      (uo(
        J,
        q + 0.05,
        H("#719e36", { map: W.grass, normalMap: W.grassNormal, normalScale: new a.Vector2(0.45, 0.45) }),
        "Pointe_enherbee_bief",
        Mt,
      ),
        Tt(
          [
            [9, 15.8],
            [5.85, 16.45],
            [5.6, 12.7],
          ],
          0.7,
          D.paving,
          "Dalles_pointe_du_bief",
          () => q - 0.005,
          Mt,
        ),
        F(
          new a.LatheGeometry(
            [
              new a.Vector2(0, 0),
              new a.Vector2(0.23, 0),
              new a.Vector2(0.28, 0.1),
              new a.Vector2(0.19, 0.4),
              new a.Vector2(0.31, 0.59),
              new a.Vector2(0.49, 0.72),
              new a.Vector2(0.51, 0.82),
              new a.Vector2(0.45, 0.82),
              new a.Vector2(0.41, 0.74),
              new a.Vector2(0.25, 0.65),
              new a.Vector2(0, 0.64),
            ],
            24,
          ),
          D.trim,
          "Vasque_pointe_du_bief",
          Mt,
        ).position.set(6.55, q + 0.08, 15.65));
      for (const [e, o] of [
        [
          [-20, 14.5],
          [-11.5, 17.2],
        ],
        [
          [-11.5, 17.2],
          [-6.5, 17],
        ],
        [
          [-6.5, 17],
          [0.8, 16.6],
        ],
        [
          [5.55, 17],
          [9.1, 16.3],
        ],
        [
          [9.1, 16.3],
          [15.9, 14.45],
        ],
        [
          [15.9, 14.45],
          [16.9, 12],
        ],
      ])
        Je([1268 + e[0] / _e, 408 + e[1] / _e], [1268 + o[0] / _e, 408 + o[1] / _e]);
      const ct = new m(D.masonry, "Parement_irregulier_des_berges_maconnees", Mt);
      for (const [e, o] of [
        [
          [-20, 14.5],
          [-11.5, 17.2],
        ],
        [
          [-11.5, 17.2],
          [-6.5, 17],
        ],
        [
          [-6.5, 17],
          [0.8, 16.6],
        ],
        [
          [5.55, 17],
          [9.1, 16.3],
        ],
        [
          [9.1, 16.3],
          [15.9, 14.45],
        ],
        [
          [15.9, 14.45],
          [16.9, 12],
        ],
      ]) {
        const r = o[0] - e[0],
          s = o[1] - e[1],
          u = Math.hypot(r, s),
          _ = -Math.atan2(s, r);
        for (let L = 0; L < 3; L++)
          for (let Ae = 0; Ae < u; ) {
            const Pe = Math.min(U(0.65, 1.06), u - Ae),
              Te = (Ae + Pe / 2) / u;
            (ct.add(
              on,
              [e[0] + r * Te, 0.19 + L * 0.32, e[1] + s * Te],
              [Math.max(0.02, Pe - 0.02), 0.302, 0.465],
              Ro[Math.floor($() * Ro.length)],
              [0, _, 0],
            ),
              (Ae += Pe));
          }
      }
      ct.finish();
      const gt = new a.Group();
      ((gt.name = "Mobilier_de_la_terrasse"),
        gt.position.set(-0.95, q + 0.085, 11.15),
        (gt.rotation.y = Math.PI / 2 - 0.24),
        Mt.add(gt));
      const Gt = H("#6f7771", { roughness: 0.87, metalness: 0.12 }),
        Ot = new m(H("#ffffff", { vertexColors: !0, roughness: 0.94 }), "Plateau_mosaique_gris_ocre", gt);
      g(2.18, 0.07, 1, [0, 0.76, 0], Gt, "Plateau_table_exterieure", gt);
      const Xt = ["#9a9b92", "#829292", "#b2a48b", "#b1a592", "#757f7d", "#c0aa8c", "#986f5b"];
      for (let e = 0; e < 11; e++)
        for (let o = 0; o < 5; o++)
          Ot.add(
            So,
            [-0.98 + e * 0.196, 0.802, -0.402 + o * 0.201],
            [0.184, 0.012, 0.187],
            Xt[(e * 7 + o * 3 + Math.floor(e / 2)) % 7],
          );
      Ot.finish();
      for (const e of [-0.8, 0.8])
        (Io([e - 0.17, 0.04, -0.4], [e + 0.17, 0.73, 0.39], 0.042, 0.045, Gt, "Pietement_croise_de_table", gt),
          Io([e + 0.17, 0.04, -0.4], [e - 0.17, 0.73, 0.39], 0.042, 0.045, Gt, "Pietement_croise_de_table", gt));
      const Wt = H("#c97a63", { roughness: 0.97 }),
        i = H("#d1c9b3", { roughness: 1 });
      for (const e of [-1, 1])
        for (const o of [-0.66, 0.65]) {
          const r = new a.Group();
          ((r.name = "Chaise_de_table"),
            r.position.set(o, 0, e * 0.96),
            (r.rotation.y = e < 0 ? 0 : Math.PI),
            gt.add(r));
          for (const u of [-0.2, 0.2])
            (Io([u, 0.03, -0.2], [u, 0.47, 0.15], 0.029, 0.029, Gt, "Pied_pliant", r),
              Io([u, 0.03, 0.2], [u, 0.51, -0.22], 0.029, 0.029, Gt, "Pied_pliant", r));
          g(0.44, 0.04, 0.42, [0, 0.46, 0], e > 0 ? Wt : i, "Assise_toile", r);
          const s = g(0.44, 0.48, 0.035, [0, 0.74, -0.22], e > 0 ? Wt : i, "Dossier_toile", r);
          s.rotation.x = -0.12;
        }
      const d = new a.Group();
      ((d.name = "Salon_de_jardin_corail"), d.position.set(-4.5, q + 0.09, 14.73), (d.rotation.y = -0.12), Mt.add(d));
      const Z = H("#d78670", { roughness: 1 }),
        ye = H("#ba6d59", { roughness: 1 }),
        nt = H("#e09a83", { roughness: 1 }),
        xt = H("#816f58", { map: W.wood, roughness: 0.95 });
      (ot(0, 0.97, 2.15, Math.PI, "Canape_corail_trois_places"),
        ot(-1.62, -0.12, 0.78, Math.PI / 2, "Fauteuil_corail_cote_lampadaire"),
        ot(0.8, -1.11, 0.78, -0.32, "Fauteuil_corail_face_au_canape"));
      const tt = new a.Group();
      ((tt.name = "Table_basse_en_bois"), d.add(tt));
      for (let e = 0; e < 7; e++) g(1.4, 0.045, 0.079, [0, 0.36, -0.27 + e * 0.09], xt, "Lame_table_basse", tt);
      for (const e of [-0.52, 0.52])
        for (const o of [-0.2, 0.2]) g(0.045, 0.34, 0.045, [e, 0.17, o], xt, "Pied_table_basse", tt);
      const l = new a.Group();
      ((l.name = "Roue_a_aubes_contre_le_moulin"), l.position.set(...$e.wheel.houseLocalCentre), _o.add(l));
      const j = H("#784b35", { roughness: 0.87, metalness: 0.42 }),
        ie = H("#443b32", { roughness: 0.78, metalness: 0.68 }),
        ze = H("#a1adb0", { metalness: 0.65, roughness: 0.5 }),
        Ye = $e.wheel.radius,
        zt = $e.wheel.width;
      for (const e of [-zt / 2, zt / 2]) {
        const o = F(new a.TorusGeometry(Ye - 0.025, 0.055, 8, 64), j, "Jante_de_roue", l);
        ((o.rotation.y = Math.PI / 2), (o.position.x = e));
        const r = F(
          new a.RingGeometry(Ye - 0.19, Ye, 64),
          new a.MeshStandardMaterial({ color: xe("#6d4331"), metalness: 0.45, roughness: 0.85, side: a.DoubleSide }),
          "Bande_de_jante",
          l,
        );
        ((r.rotation.y = Math.PI / 2), (r.position.x = e));
        for (let s = 0; s < 8; s++) {
          const u = (s * Math.PI) / 4;
          Io([e, 0, 0], [e, Math.sin(u) * (Ye - 0.1), Math.cos(u) * (Ye - 0.1)], 0.07, 0.09, ie, "Rayon_de_roue", l);
        }
      }
      const ht = F(new a.CylinderGeometry(0.12, 0.12, 1.7, 16), ie, "Axe_de_roue", l);
      ht.rotation.z = Math.PI / 2;
      for (let e = 0; e < 20; e++) {
        const o = (e * Math.PI * 2) / 20,
          r = Ye - 0.14,
          s = g(zt + 0.04, 0.045, 0.38, [0, Math.sin(o) * r, Math.cos(o) * r], j, "Aube_metallique", l);
        s.rotation.x = Math.PI / 2 - o;
        for (const u of [-zt / 2, zt / 2]) {
          const _ = g(0.07, 0.25, 0.075, [u, Math.sin(o) * (r - 0.1), Math.cos(o) * (r - 0.1)], ie, "Attache_aube", l);
          _.rotation.x = Math.PI / 2 - o;
        }
      }
      g(0.26, 0.36, 0.4, [-0.78, 0, 0], D.stone, "Palier_contre_le_mur", l);
      const Lt = new a.Group();
      ((Lt.name = "Vanne_du_moulin"), Lt.position.set(3.3, 0, 8.2), (Lt.rotation.y = -0.11), Mt.add(Lt));
      for (const e of [-0.75, 0.75])
        (g(0.1, 1.66, 0.12, [e, 0.88, 0], ze, "Glissiere_galvanisee", Lt),
          g(0.09, 0.09, 1.24, [e, 1.59, -0.54], ze, "Longeron_du_chassis", Lt));
      for (const e of [-1.1, 0.04]) g(1.66, 0.115, 0.12, [0, 1.64, e], ze, "Traverse_du_chassis", Lt);
      g(1.3, 0.9, 0.065, [0, 0.63, -0.015], j, "Tablier_de_vanne_du_moulin", Lt);
      const Qt = F(new a.CylinderGeometry(0.1, 0.1, 0.34, 16), ze, "Tambour_du_treuil", Lt);
      ((Qt.rotation.z = Math.PI / 2),
        Qt.position.set(0.37, 1.42, 0.06),
        Io([0.37, 1.4, 0.06], [0, 1.05, -0.015], 0.012, 0.012, ie, "Cable_de_levage", Lt),
        Io([0.61, 1.42, 0.06], [0.61, 1.18, 0.06], 0.032, 0.032, ie, "Manivelle_du_treuil", Lt),
        g(0.17, 0.055, 0.06, [0.67, 1.18, 0.06], ie, "Poignee_de_manivelle", Lt));
      const Yt = new a.Group();
      ((Yt.name = "Vanne_du_passage_naturel"),
        Yt.position.set($e.riverGate.worldCentre[0], 0, $e.riverGate.worldCentre[1]),
        (Yt.rotation.y = $e.riverGate.angle),
        Mt.add(Yt));
      const Et = H("#878579", { map: W.stone, roughness: 1 }),
        Zt = H("#53463b", { metalness: 0.48, roughness: 0.86 });
      for (const e of [-1.1, 1.1]) g(0.25, 2.22, 0.36, [e, 2.04, 0], Et, "Montant_en_beton_de_vanne", Yt);
      (g(2.77, 0.23, 0.54, [0, 3.17, 0], Et, "Traverse_en_beton", Yt),
        g(0.44, 0.54, 0.35, [0, 3.53, 0.02], j, "Boitier_de_cremaillere", Yt),
        F(new a.CylinderGeometry(0.043, 0.043, 3.14, 12), Zt, "Tige_filetee_de_vanne", Yt).position.set(0, 2.04, 0.06));
      for (let e = 0.54; e < 3.6; e += 0.105) {
        const o = F(new a.TorusGeometry(0.052, 0.015, 5, 10), Zt, "Filet_de_vis", Yt);
        ((o.rotation.x = Math.PI / 2), o.position.set(0, e, 0.06));
      }
      g(1.72, 0.95, 0.085, [0, 0.64, 0.035], Zt, "Tablier_de_vanne_naturelle", Yt);
      for (const e of [-0.96, 0.96]) g(0.11, 1.2, 0.14, [e, 0.69, 0.02], Zt, "Guide_de_vanne_naturelle", Yt);
      for (const e of [-1.1, 1.1]) g(0.1, 0.12, 1.2, [e, 1.14, -0.66], ze, "Support_du_caillebotis", Yt);
      for (let e = 0; e < 23; e++)
        g(0.023, 0.055, 1.1, [-1.07 + e * 0.097, 1.22, -0.66], ze, "Barreau_du_caillebotis", Yt);
      for (const e of [-1.19, -0.13]) g(2.25, 0.065, 0.045, [0, 1.22, e], ze, "Cadre_du_caillebotis", Yt);
      for (const e of [-1, 1]) g(0.48, 1.03, 2, [e * 1.1, 0.52, 0.15], D.stone, "Jouee_maconnee_vanne_naturelle", Yt);
      const go = H("#48695c", { roughness: 0.68, metalness: 0.34 }),
        Co = [[1239.5, 464.7]],
        Ao = [],
        pn = [];
      for (const e of Co) {
        const o = new a.Group();
        ((o.name = "Lampadaire"), o.position.copy(Ce(e, q + 0.055)), Mt.add(o));
        const r = [
          [0.31, 0],
          [0.33, 0.07],
          [0.26, 0.12],
          [0.22, 0.18],
          [0.205, 0.32],
          [0.16, 0.4],
          [0.135, 0.57],
          [0.12, 0.64],
          [0.1, 1.04],
          [0.081, 2.96],
          [0.115, 3.01],
          [0.13, 3.08],
          [0.085, 3.17],
          [0.09, 3.34],
        ].map((Pe) => new a.Vector2(...Pe));
        F(new a.LatheGeometry(r, 12), go, "Fut_en_fonte_profile", o);
        const s = H("#859681", { metalness: 0.4, roughness: 0.65 });
        for (const [Pe, Te] of [
          [0.09, 0.304],
          [0.39, 0.166],
          [0.63, 0.128],
          [3.075, 0.132],
        ]) {
          const it = F(new a.TorusGeometry(Te, 0.016, 5, 12), s, "Collier_de_fonte", o);
          ((it.position.y = Pe), (it.rotation.x = Math.PI / 2));
        }
        const u = new a.MeshStandardMaterial({
          color: xe("#c9d9c2"),
          roughness: 0.18,
          metalness: 0.06,
          emissive: xe("#ffc272"),
          emissiveIntensity: 0.15,
        });
        (pn.push(u), g(0.42, 0.63, 0.42, [0, 3.71, 0], u, "Vitres_lanterne", o));
        for (const Pe of [3.38, 4.04]) g(0.52, 0.065, 0.52, [0, Pe, 0], go, "Cadre_lanterne", o);
        for (const Pe of [-0.23, 0.23])
          for (const Te of [-0.23, 0.23]) {
            const it = g(0.035, 0.67, 0.035, [Pe, 3.71, Te], go, "Montant_lanterne", o);
            for (const dt of [-1, 1]) {
              const Ue = F(new a.TorusGeometry(0.09, 0.011, 4, 10, Math.PI * 1.35), go, "Volute_de_fonte", o);
              (Ue.position.set(Pe, 3.46, Te), (Ue.rotation.y = dt === -1 ? Math.PI / 2 : 0));
            }
          }
        const _ = F(new a.ConeGeometry(0.43, 0.25, 4), go, "Chapeau_lanterne", o);
        ((_.position.y = 4.185),
          (_.rotation.y = Math.PI / 4),
          (F(new a.SphereGeometry(0.065, 8, 6), s, "Fleuron_lanterne", o).position.y = 4.36));
        const L = F(new a.ConeGeometry(0.044, 0.17, 8), go, "Pointe_lanterne", o);
        L.position.y = 4.46;
        const Ae = new a.PointLight(16760426, 0, 30, 2);
        (Ae.position.set(0, 3.75, 0), o.add(Ae), Ao.push(Ae));
      }
      for (const e of [
        [1251.3, 465.4],
        [1229.1, 465.4],
      ]) {
        const o = He(e);
        g(1.8, 0.2, 0.52, [o[0], q + 0.5, o[1]], D.trim, "Banc_de_pierre", Mt);
        for (const r of [-0.6, 0.6]) g(0.2, 0.5, 0.45, [o[0] + r, q + 0.25, o[1]], D.stone, "Pied_banc", Mt);
      }
      for (const e of [
        [1223.5, 464.3],
        [1272.8, 467.2],
      ]) {
        const o = He(e);
        (F(new a.CylinderGeometry(0.47, 0.2, 0.75, 8), D.trim, "Vasque", Mt).position.set(o[0], q + 0.45, o[1]),
          F(new a.IcosahedronGeometry(1, 1), H("#71903f", { flatShading: !0 }), "Plantes_en_vasque", Mt).position.set(
            o[0],
            q + 0.9,
            o[1],
          ),
          Mt.children[Mt.children.length - 1].scale.set(0.48, 0.35, 0.48));
      }
      const bn = [],
        en = new a.Group();
      ((en.name = "Colline_et_murets_plantes"), Mt.add(en));
      const Ln = new a.Group();
      ((Ln.name = "Escalier_en_lacets_de_la_colline"), en.add(Ln));
      const sa = new a.Group();
      ((sa.name = "Deux_jardinieres_rectangulaires_en_beton"), Mt.add(sa));
      for (const [e, o] of $e.concreteBeds.entries()) {
        const [r, s] = o.centre,
          u = yt(r, s) + 0.035,
          _ = new a.Group();
        ((_.name = "Jardiniere_beton_" + (e + 1)), _.position.set(r, u, s), sa.add(_));
        const L = H("#a5a294", { map: W.stone });
        for (const Ae of [-1, 1])
          g(0.13, 0.32, o.length, [(Ae * o.width) / 2, 0.16, 0], L, "Bordure_longue_en_beton", _);
        for (const Ae of [-1, 1])
          g(o.width + 0.13, 0.32, 0.13, [0, 0.16, (Ae * o.length) / 2], L, "Bordure_courte_en_beton", _);
        g(
          o.width - 0.15,
          0.06,
          o.length - 0.15,
          [0, 0.11, 0],
          H("#526f39", { map: W.grass }),
          "Vegetation_dans_jardiniere",
          _,
        );
      }
      const Yn = new a.Group();
      ((Yn.name = "Passerelle_bout_du_grand_etang"),
        Yn.position.set(M[0], X.bridge.deckLevel, M[1]),
        (Yn.rotation.y = X.bridge.angleRadians),
        Mt.add(Yn));
      const cr = H("#a38561", { map: W.wood, roughness: 0.97 }),
        On = X.bridge.length,
        Ha = X.bridge.width;
      for (let e = 0; e < 25; e++)
        g(On / 25 - 0.018, 0.13, Ha, [-On / 2 + ((e + 0.5) * On) / 25, 0, 0], cr, "Planche_passerelle", Yn);
      for (const e of [-Ha / 2 + 0.1, Ha / 2 - 0.1]) {
        g(On + 0.3, 0.22, 0.13, [0, -0.16, e], D.wood, "Longeron_passerelle", Yn);
        for (let o = 0; o < 4; o++) g(0.13, 1.1, 0.13, [-On / 2 + (o * On) / 3, 0.48, e], cr, "Poteau_garde_corps", Yn);
        for (const o of [0.45, 0.95]) g(On + 0.2, 0.12, 0.1, [0, o, e], cr, "Lisse_garde_corps", Yn);
      }
      for (const e of [-On / 2, On / 2]) g(0.65, 0.63, Ha + 0.4, [e, -0.4, 0], D.stone, "Appui_de_pont", Yn);
      const qi = Math.cos(Yn.rotation.y),
        Oi = Math.sin(Yn.rotation.y);
      for (const e of [-1, 1]) {
        const o = [On * 0.5, On * 0.5 + 2.3, On * 0.5 + 5].map((r) => [M[0] + qi * r * e, M[1] - Oi * r * e]);
        Tt(
          o,
          X.bridge.width,
          H("#648347", { map: W.grass }),
          "Approche_enherbee_pont",
          (r, s) => Math.max(0.66, yt(r, s)),
          Mt,
        );
      }
      const la = new a.Group();
      ((la.name = "Passerelle_amont_du_petit_bassin"),
        Mt.add(la),
        la.position.copy(Ce(X.upstreamFootbridge.centre, X.upstreamFootbridge.deckLevel)),
        (la.rotation.y = X.upstreamFootbridge.angleRadians));
      for (let e = 0; e < 19; e++)
        g(0.185, 0.09, X.upstreamFootbridge.width, [-1.8 + e * 0.2, 0, 0], D.wood, "Planche_petit_passage", la);
      for (const e of [-X.upstreamFootbridge.width * 0.5 + 0.1, X.upstreamFootbridge.width * 0.5 - 0.1]) {
        g(3.85, 0.15, 0.1, [0, -0.12, e], D.wood, "Solive_petit_passage", la);
        for (const o of [-1.6, 1.6]) g(0.045, 0.78, 0.045, [o, 0.36, e], D.metal, "Petit_poteau_de_passerelle", la);
        g(3.3, 0.045, 0.045, [0, 0.72, e], D.metal, "Main_courante_passerelle", la);
      }
      for (const e of X.featuresV7.footbridges) {
        const o = new a.Group();
        ((o.name = e.name), o.position.set(e.centre[0], e.deckLevel, e.centre[1]), (o.rotation.y = e.angle), Mt.add(o));
        const r = H("#b4946f", { map: W.wood, roughness: 0.97 }),
          s = Math.ceil(e.length / 0.15);
        for (let u = 0; u < s; u++)
          g(
            e.length / s - 0.008,
            0.1,
            e.width,
            [-e.length / 2 + ((u + 0.5) * e.length) / s, 0, 0],
            r,
            "Planche_de_petit_pont",
            o,
          );
        for (const u of [-e.width * 0.37, e.width * 0.37])
          g(e.length, 0.15, 0.1, [0, -0.11, u], D.metal, "Support_de_passerelle", o);
        for (const u of [-e.length / 2 + 0.08, e.length / 2 - 0.08])
          g(0.22, 0.16, e.width + 0.1, [u, -0.17, 0], D.stone, "Appui_de_petit_pont", o);
      }
      const Xa = new a.Group();
      ((Xa.name = "Cascades_et_deversoirs"), Jt.add(Xa));
      const Ui = H("#d5e1d9", {
          map: W.foam,
          roughness: 0.56,
          metalness: 0.05,
          transparent: !0,
          opacity: 0.84,
          side: a.DoubleSide,
          depthWrite: !1,
        }),
        Hr = new m(
          H("#e6ece3", {
            vertexColors: !0,
            color: 16777215,
            map: W.foam,
            roughness: 0.7,
            transparent: !0,
            opacity: 0.38,
            depthWrite: !1,
            side: a.DoubleSide,
          }),
          "Ecume_des_cascades",
          Xa,
        );
      for (const e of X.cascades) {
        const o = He(e.centre),
          r = new a.Vector2(...e.direction).normalize(),
          s = -r.y,
          u = r.x,
          _ = new a.Group();
        ((_.name = e.name), Xa.add(_));
        const L = e.name === "Chute_du_bief_derriere_le_moulin",
          Ae = g(
            L ? e.width - 0.16 : e.width + 0.5,
            L ? 0.12 : 0.32,
            L ? 0.18 : 0.58,
            [o[0], e.upperLevel - 0.2, o[1]],
            D.stone,
            "Seuil_en_pierre",
            _,
          );
        Ae.rotation.y = -Math.atan2(u, s);
        const Pe = [],
          Te = [];
        for (let dt = 0; dt < 42; dt++) {
          const Ue = -e.width / 2 + ((dt + 0.5) * e.width) / 42,
            wt = (e.width / 42) * 0.995,
            St = [
              [-0.35, e.upperLevel + 0.018],
              [0.02, e.upperLevel - 0.025],
              [0.36, e.upperLevel - 0.13],
              [0.72, e.lowerLevel + 0.09],
              [1.26, e.lowerLevel + 0.018],
            ];
          for (let Nt = 0; Nt < St.length - 1; Nt++) {
            const Mo = St[Nt],
              so = St[Nt + 1],
              no = [o[0] + s * (Ue - wt / 2) + r.x * Mo[0], Mo[1], o[1] + u * (Ue - wt / 2) + r.y * Mo[0]],
              Lo = [o[0] + s * (Ue + wt / 2) + r.x * Mo[0], Mo[1], o[1] + u * (Ue + wt / 2) + r.y * Mo[0]],
              lo = [o[0] + s * (Ue + wt / 2) + r.x * so[0], so[1], o[1] + u * (Ue + wt / 2) + r.y * so[0]],
              Zo = [o[0] + s * (Ue - wt / 2) + r.x * so[0], so[1], o[1] + u * (Ue - wt / 2) + r.y * so[0]];
            (Pe.push(...no, ...lo, ...Lo, ...no, ...Zo, ...lo),
              Te.push(
                dt / 12,
                Nt / 4,
                (dt + 1) / 12,
                (Nt + 1) / 4,
                (dt + 1) / 12,
                Nt / 4,
                dt / 12,
                Nt / 4,
                dt / 12,
                (Nt + 1) / 4,
                (dt + 1) / 12,
                (Nt + 1) / 4,
              ));
          }
        }
        const it = new a.BufferGeometry();
        (it.setAttribute("position", new a.Float32BufferAttribute(Pe, 3)),
          it.setAttribute("uv", new a.Float32BufferAttribute(Te, 2)),
          it.computeVertexNormals(),
          (F(it, Ui, "Nappe_d_eau_en_chute", _).castShadow = !1));
        for (let dt = 0; dt < 76; dt++) {
          const Ue = U(-e.width * 0.5, e.width * 0.5),
            wt = U(0.8, 2.5),
            St = o[0] + s * Ue + r.x * wt,
            Nt = o[1] + u * Ue + r.y * wt;
          Hr.add(
            new a.CircleGeometry(1, 8),
            [St, e.lowerLevel + 0.026 + U(0, 0.025), Nt],
            [U(0.04, 0.11), U(0.055, 0.16), 1],
            xe("#c7dad0").multiplyScalar(U(0.72, 0.95)),
            [-Math.PI / 2, 0, U(0, 6.28)],
          );
        }
      }
      Hr.finish();
      const Xr = new m(D.canopy, "Couronnes_vegetales_denses", _t),
        Zr = new m(D.foliage, "Feuillages_detailles", _t),
        Yr = new m(D.trunk, "Troncs_et_branches", _t),
        Hi = new a.PlaneGeometry(1, 1),
        hs = ["#526e46", "#72835a", "#859162", "#507055", "#76865a", "#57765c", "#5c7958", "#85946b"],
        ps = ur(8, 6),
        Qr = ur(12, 8),
        ms = ur(7, 5),
        ca = [];
      await te.step("Arbres et pelouse\u2026");
      let Ya = 0;
      for (const e of X.woodlandSamples) {
        const o = He(e),
          [r, s] = o;
        if (
          r < Bt.x0 + 3 ||
          r > Bt.x1 - 3 ||
          s < Bt.z0 + 3 ||
          s > Bt.z1 - 3 ||
          ue(o, oe) ||
          ue(o, y) ||
          ue(o, I) ||
          ue(o, Be) ||
          Re.some((L, Ae) => ue(o, L.poly) || se(o, L.poly) < (Ae === 0 ? 2.2 : 4.8)) ||
          ee.some((L) => ge(o, L).distance < L.width / 2 + 2.7) ||
          Se.some((L) => se(o, L, !1) < 2.4) ||
          se(o, B, !1) < 2.1 ||
          Math.pow((r - 26.3) / 7.5, 2) + Math.pow((s - 27) / 13.5, 2) < 1 ||
          (r > 15 && r < 128 && s > -20 && s < 0) ||
          (r > 93 && r < 117 && s > -43 && s < -17) ||
          Math.pow((r + 6) / 27, 2) + Math.pow((s - 5) / 27, 2) < 1 ||
          (r > -43 && r < -7 && s > -36 && s < 18) ||
          Math.hypot(r - M[0], s - M[1]) < 18 ||
          se(o, kt, !1) < 3.3 ||
          (r > -48 && r < -14 && s > 26 && s < 59 && $() < 0.82) ||
          $() < 0.27
        )
          continue;
        const u = U(10.5, 17.5) * e[2],
          _ = Math.hypot(r, s) < 50;
        (Za(r, s, u, r < -12 && s < -24 ? ($() < 0.52 ? 2 : $() < 0.52 ? 1 : 0) : $() < 0.025 ? 2 : 0, yt(r, s), _),
          Ya++);
      }
      for (const [e, o, r] of [
        [[1216, 554], 14.6, 2],
        [[987, 801], 9, 0],
        [[1101, 735], 15, 0],
        [[1118, 754], 13, 0],
        [[1087, 709], 12, 0],
      ]) {
        const s = He(e);
        et.some((u) => ue(s, u)) && (Za(s[0], s[1], o, r, 0.35, !0), Ya++);
      }
      for (const [e, o, r] of [
        [[1204, 467], 16, 0],
        [[1308, 370], 17, 0],
        [[1241, 352], 19, 0],
      ]) {
        const s = He(e);
        ae(s, 1.5) || Za(s[0], s[1], o, r, yt(...s), !0);
      }
      for (const [e, o, r] of [
        [-21, -22, 19],
        [-31, -15, 22],
        [-36, -25, 20],
        [-17, -31, 21],
      ])
        dr(e, o, r);
      for (const [e, o, r] of [
        [77, -11, 13],
        [95, -20, 14],
        [112, -18, 15],
        [127, -18, 13],
        [37, -20, 10],
      ])
        ae([e, o], 0.6) || dr(e, o, r, yt(e, o), !0);
      const Jr = ca.find((e) => Math.hypot(e.x + 17.28, e.z - 15.93) < 1);
      Jr &&
        Object.assign(Jr, {
          species: "oak",
          height: 20.5,
          diameter: 1.13,
          spread: 1.17,
          label: "Grand ch\xEAne devant la d\xE9pendance",
        });
      for (const [e, o, r] of [
        [-17, -42, 18],
        [-24, -44, 20],
        [-30, -40, 17],
        [-39, -38, 19],
        [-46, -33, 18],
        [-34, -48, 21],
        [-22, -51, 18],
      ])
        ca.push({
          x: e,
          z: o,
          height: r,
          species: "birch",
          diameter: 0.32,
          spread: 0.9,
          rotation: e,
          variant: Math.abs(Math.round(e)) % 4,
          label: "Feuillu du haut de la colline",
        });
      ca.push(
        {
          x: 13,
          z: 2.5,
          height: 7.5,
          species: "oak",
          diameter: 0.46,
          spread: 1.16,
          variant: 1,
          label: "Arbre du jardin pr\xE8s de la vanne",
        },
        {
          x: 19.7,
          z: 5.3,
          height: 6.5,
          species: "oak",
          diameter: 0.34,
          spread: 1.12,
          variant: 3,
          label: "Arbre pr\xE8s de la vanne naturelle",
        },
      );
      {
        const [e, o] = $e.pollardedTree.worldCentre,
          r = yt(e, o),
          s = $e.pollardedTree.height,
          u = new a.Group();
        ((u.name = "Arbre_souche_du_jardin_intermediaire"), u.position.set(e, r, o), Mt.add(u));
        const _ = new m(D.trunk, "Tronc_et_branches_de_l_arbre_taille", u);
        Kr([0, 0, 0], [0.15, s * 0.68, 0], 0.34, "#7a776a", _);
        for (let L = 0; L < 6; L++) {
          const Ae = L * 2.4,
            Pe = U(1, 1.9);
          Kr([0, s * 0.46, 0], [Math.cos(Ae) * Pe, U(s * 0.79, s), Math.sin(Ae) * Pe], 0.16, "#88877b", _);
        }
        _.finish();
      }
      const fr = new m(D.foliage, "Arbustes_et_couvre_sol", en);
      for (const e of bn)
        for (let o = 0; o < e.length; o++) {
          const [r, s] = e[o];
          for (let u = 0; u < 4; u++) {
            const _ = r + U(-2, 0.3),
              L = s + U(-2, 0.3),
              Ae = yt(_, L),
              Pe = U(0.6, 1.25);
            ma(_, Ae + Pe * 0.75, L, Pe, ["#577a49", "#72874e", "#8c995e", "#537747"][u], 13, 0.85, fr);
          }
        }
      for (let e = 0; e < 46; e++) {
        const o = U(-31, -14),
          r = U(-22, -2),
          s = yt(o, r);
        s > 3 && ma(o, s + 0.55, r, U(0.5, 1.05), "#688849", 9, 0.8, fr);
      }
      fr.finish();
      const Ka = new a.Group();
      ((Ka.name = "Massif_de_rhododendrons"), _t.add(Ka));
      const $r = new m(
          H("#315e3b", { vertexColors: !0, color: 16777215, flatShading: !0, roughness: 1 }),
          "Volume_du_massif_de_rhododendrons",
          Ka,
        ),
        hr = new m(D.foliage, "Feuilles_du_massif_de_rhododendrons", Ka);
      for (let e = 0; e < 17; e++) {
        const o = 19 + e * 1.32,
          r = U(2.2, 3),
          s = [];
        for (let L = 0; L < vt[0].poly.length; L++) {
          const Ae = vt[0].poly[L],
            Pe = vt[0].poly[(L + 1) % vt[0].poly.length];
          Ae[1] > o != Pe[1] > o && s.push(Ae[0] + ((o - Ae[1]) / (Pe[1] - Ae[1])) * (Pe[0] - Ae[0]));
        }
        const u = Math.max(...s) + r * 0.35,
          _ = Math.max(0.12, Rt(u, o));
        ($r.add(Qr, [u, _ + 1.65, o], [r * 0.5, U(0.8, 1.05), r * 0.42], ["#365c35", "#3a6741", "#53783f"][e % 3], [
          0,
          e * 0.71,
          0,
        ]),
          ma(u, _ + 2, o, r * 0.95, "#467638", 40, 0.75, hr));
        for (let L = 0; L < 4; L++) {
          const Ae = L * 1.57;
          ma(
            u + Math.cos(Ae) * r * 0.66,
            _ + 1.8 + U(-0.35, 0.75),
            o + Math.sin(Ae) * r * 0.6,
            r * 0.65,
            "#477744",
            10,
            0.9,
            hr,
          );
        }
      }
      ($r.finish(), hr.finish());
      const pr = new a.Group();
      ((pr.name = "Buissons_au_bord_de_la_vanne_naturelle"), Mt.add(pr));
      const Er = new m(D.foliage, "Feuillage_des_buissons_de_la_vanne", pr);
      for (const [e, o, r] of [
        [11.5, 1.5, 1.5],
        [14.5, 5.1, 1.25],
        [15.6, 6.5, 1.2],
        [19.2, 4.4, 1.35],
        [22.8, 12.4, 1.25],
      ])
        if (!ae([e, o], 0.1)) {
          const s = Rt(e, o);
          for (let u = 0; u < 3; u++)
            ma(
              e + Math.sin(u * 2.3) * r * 0.3,
              s + r * 0.6 + u * 0.12,
              o + Math.cos(u * 2.3) * r * 0.3,
              r,
              ["#5c743d", "#617b42", "#7d8a4e"][u],
              15,
              0.85,
              Er,
            );
        }
      (Er.finish(), Xr.add(Qr, [7.8, yt(7.8, 3.2) + 1.55, 3.2], [1.05, 1.38, 1.07], "#396442"));
      for (let e = 0; e < 12; e++) {
        const o = e * 2.4,
          r = yt(7.8, 3.2) + 0.6 + (e % 4) * 0.6;
        ma(7.8 + Math.cos(o) * 0.76, r, 3.2 + Math.sin(o) * 0.76, 0.62, "#527449", 10, 1.2);
      }
      Za(M[0] - 8, M[1] - 7, 14, 0, yt(M[0] - 8, M[1] - 7), !0);
      for (const [e, o, r] of [
        [8, 10, 12],
        [-9, 13, 9],
        [17, 6, 11],
      ]) {
        const s = M[0] + e,
          u = M[1] + o;
        vt.some((_) => ue([s, u], _.poly)) || dr(s, u, r, yt(s, u), !0);
      }
      const mr = new m(D.tree, "Joncs_et_iris_du_pont", Mt),
        Qa = new a.PlaneGeometry(0.8, 1, 1, 3);
      for (let e = 0; e < Qa.attributes.position.count; e++) {
        const o = Qa.attributes.position,
          r = o.getY(e);
        (o.setX(e, o.getX(e) * (0.56 - r)), o.setZ(e, (r + 0.5) * (r + 0.5) * 0.22));
      }
      Qa.computeVertexNormals();
      for (const [e, o] of [
        [1, -1],
        [2, 1],
        [3, -1],
        [4, 1],
      ]) {
        const r = kt[e],
          s = kt[e - 1],
          u = r[0] - s[0],
          _ = r[1] - s[1],
          L = Math.hypot(u, _),
          Ae = e === 2 ? 2.1 : 0,
          Pe = r[0] - ((o * _) / L) * 1.6 + (u / L) * Ae,
          Te = r[1] + ((o * u) / L) * 1.6 + (_ / L) * Ae;
        for (let it = 0; it < 22; it++) {
          const dt = U(0, 6.28),
            Ue = U(0, 0.75),
            wt = U(0.65, 1.2),
            St = Pe + Math.cos(dt) * Ue,
            Nt = Te + Math.sin(dt) * Ue;
          (mr.add(Qa, [St, 0.28 + wt / 2, Nt], [0.06, wt, 0.11], it % 3 ? "#6b7c39" : "#98a152", [
            U(-0.28, 0.28),
            dt,
            U(-0.22, 0.22),
          ]),
            e === 2 && it % 6 === 0 && mr.add(G, [St, wt + 0.23, Nt], [0.1, 0.07, 0.13], "#d8b53e"));
        }
      }
      mr.finish();
      const Tr = new m(
        H("#7d884e", { vertexColors: !0, color: 16777215, side: a.DoubleSide }),
        "Herbes_et_carex_des_berges",
        Jt,
      );
      for (const e of Re)
        for (let o = 0; o < e.poly.length; o += 3) {
          const r = e.poly[o],
            s = e.poly[(o + 1) % e.poly.length],
            u = s[0] - r[0],
            _ = s[1] - r[1],
            L = Math.hypot(u, _);
          if (L < 0.1) continue;
          let Ae = [r[0] - (_ / L) * 0.85, r[1] + (u / L) * 0.85];
          (ue(Ae, e.poly) && (Ae = [r[0] + (_ / L) * 0.85, r[1] - (u / L) * 0.85]),
            !(ae(Ae, 0.15) || (Ae[0] > -27 && Ae[0] < 13 && Ae[1] > -14 && Ae[1] < 24)) &&
              ei(
                Ae[0],
                Ae[1],
                o % 4 === 0 ? 0.92 : 0.35,
                o % 4 === 0 ? 0.82 : 0.4,
                o % 4 === 0 ? 16 : 9,
                Math.max(e.level + 0.1, Rt(...Ae)),
              ));
        }
      for (const [e, o, r] of [
        [12.5, -9, 1.35],
        [23, -1, 1.2],
        [18, 8, 1.1],
        [14, 11, 1.25],
        [-105, 107, 1],
        [-109, 114, 1.1],
      ])
        ae([e, o], 0.2) || ei(e, o, r, 0.9, 18);
      Tr.finish();
      for (const e of et)
        for (let o = 0; o < 9; o++) {
          const r = e[Math.floor($() * e.length)],
            s = e.reduce((L, Ae) => [L[0] + Ae[0] / e.length, L[1] + Ae[1] / e.length], [0, 0]),
            u = s[0] * 0.32 + r[0] * 0.68,
            _ = s[1] * 0.32 + r[1] * 0.68;
          ma(u, 0.72, _, U(0.35, 0.75), o % 3 ? "#587e43" : "#899755", 5, 0.75);
        }
      const gr = new a.Group();
      ((gr.name = "Pelouse_detaillee"), Mt.add(gr));
      const Xi = H("#74874c", { vertexColors: !0, color: 16777215, roughness: 0.93, side: a.DoubleSide }),
        gs = new m(Xi, "Brins_d_herbe_des_jardins", gr),
        Da = new a.BufferGeometry();
      (Da.setAttribute(
        "position",
        new a.Float32BufferAttribute([-0.017, 0, 0, 0.017, 0, 0, 0.008, 0.63, 0.09, 0, 1, 0.23], 3),
      ),
        Da.setIndex([0, 1, 2, 0, 2, 3]),
        Da.computeVertexNormals(),
        Da.setAttribute(
          "color",
          new a.Float32BufferAttribute([0.72, 0.72, 0.72, 0.72, 0.72, 0.72, 1, 1, 1, 1.12, 1.12, 1.12], 3),
        ));
      let ti = 0;
      for (let e = 0; e < 15e3; e++) {
        const o = e > 12e3,
          r = o ? U(-43, -12) : U(5.5, 89),
          s = o ? U(-42, 2) : U(-44, 18),
          u = [r, s];
        if (
          !(
            ae(u, 0.32) ||
            ue(u, nn) ||
            ue(u, gn) ||
            se(u, B, !1) < 0.9 ||
            Se.some((L) => se(u, L, !1) < 1.8) ||
            (r < 8.5 && s < 6 && s > -12) ||
            $e.concreteBeds.some(
              (L) => Math.abs(r - L.centre[0]) < L.width / 2 + 0.3 && Math.abs(s - L.centre[1]) < L.length / 2 + 0.3,
            ) ||
            X.featuresV7.footbridges.some((L) => Math.hypot(r - L.centre[0], s - L.centre[1]) < 1.9) ||
            (ue(u, J) ? Math.max(q + 0.05, Rt(r, s)) : Rt(r, s)) < 0.13
          )
        ) {
          ti++;
          for (let L = 0; L < 25; L++) $();
        }
      }
      (Zr.finish(), Xr.finish(), Yr.finish());
      const oi = new m(
        H("#939588", { vertexColors: !0, color: 16777215, map: W.stone, normalMap: W.stoneNormal }),
        "Rochers_des_iles",
        To,
      );
      for (let e = 0; e < 16; e++) {
        const o = He([U(1198, 1226), U(533, 564)]);
        ue(o, et[0]) &&
          oi.add(
            Qe,
            [o[0], 0.58, o[1]],
            [U(0.18, 0.48), U(0.22, 0.6), U(0.18, 0.4)],
            ["#7b8376", "#92978b", "#6c7568"][e % 3],
            [0, U(0, 6.28), U(-0.4, 0.4)],
          );
      }
      oi.finish();
      const ga = H("#76807e", { metalness: 0.56, roughness: 0.52 }),
        ua = new a.Group();
      ((ua.name = "Details_photographiques_du_moulin"), _o.add(ua));
      for (const e of [-1, 1]) {
        const o = F(new a.CylinderGeometry(0.087, 0.087, 14.72, 12, 1, !0), ga, "Gouttiere_en_zinc", ua);
        ((o.rotation.x = Math.PI / 2), o.position.set(e * 4.46, 6.44, 0));
        for (const r of [-7.04, 7.03]) {
          (Io([e * 4.45, 6.43, r], [e * 4.32, 5.88, r], 0.085, 0.085, ga, "Coude_de_descente", ua),
            F(new a.CylinderGeometry(0.051, 0.051, 5.78, 10), ga, "Descente_eaux_pluviales", ua).position.set(
              e * 4.32,
              2.99,
              r,
            ));
          for (const u of [0.53, 2.6, 4.75]) {
            const _ = F(new a.TorusGeometry(0.062, 0.011, 5, 10), ga, "Collier_de_descente", ua);
            ((_.rotation.x = Math.PI / 2), _.position.set(e * 4.32, u, r));
          }
        }
      }
      const Zi = H("#bebcb0", { map: W.stone, normalMap: W.stoneNormal, normalScale: new a.Vector2(0.35, 0.35) });
      for (const e of [-1, 1])
        Io([e * 4.34, 6.46, 7.3], [0, 10.11, 7.3], 0.13, 0.14, Zi, "Rive_de_pignon_en_pierre", ua);
      const br = new m(D.masonry, "Pierres_des_cheminees", ua);
      for (const e of [-6.2, 6.3])
        for (let o = 0; o < 9; o++)
          for (const r of [-1, 1]) {
            const s = 9.68 + o * 0.19;
            for (let u = 0; u < 3; u++)
              br.add(
                on,
                [-0.33 + u * 0.33, s, e + r * 0.46],
                [0.315, 0.168, 0.045],
                ["#b0aea3", "#9e9e94", "#c0bbac"][(u + o) % 3],
              );
            for (let u = 0; u < 3; u++)
              br.add(
                on,
                [r * 0.485, s, e - 0.3 + u * 0.3],
                [0.282, 0.17, 0.045],
                ["#aaa89e", "#b7b5a8", "#989b93"][(u + o) % 3],
                [0, Math.PI / 2, 0],
              );
          }
      br.finish();
      const ba = new a.Group();
      ((ba.name = "Chauffage_de_terrasse"),
        ba.position.set(-1.82, q + 0.1, 9.27),
        Mt.add(ba),
        (F(
          new a.CylinderGeometry(0.25, 0.3, 0.67, 20),
          H("#333c3e", { metalness: 0.45, roughness: 0.6 }),
          "Bouteille_du_chauffage",
          ba,
        ).position.y = 0.36),
        (F(new a.CylinderGeometry(0.035, 0.043, 1.28, 12), ga, "Colonne_du_chauffage", ba).position.y = 1.3),
        (F(new a.CylinderGeometry(0.19, 0.13, 0.22, 20), ga, "Bruleur_du_chauffage", ba).position.y = 1.94),
        (F(new a.CylinderGeometry(0.38, 0.45, 0.06, 32), ga, "Reflecteur_du_chauffage", ba).position.y = 2.08));
      const ni = new m(
        H("#798457", {
          vertexColors: !0,
          color: 16777215,
          map: W.leaves,
          alphaTest: 0.45,
          side: a.DoubleSide,
          roughness: 1,
        }),
        "Petites_plantes_des_murets",
        Mt,
      );
      for (let e = 0; e < 170; e++) {
        const o = $(),
          r = -19 + 19 * o,
          s = 14.5 + 2.2 * Math.sin(o * 1.57),
          u = U(0.055, 0.15);
        ni.add(Hi, [r, q + 0.085, s], [u * 2, u * 1.6, 1], ["#748451", "#788847", "#84965a"][e % 3], [
          -Math.PI / 2,
          0,
          U(0, 6.28),
        ]);
      }
      ni.finish();
      const yr = Xe.getObjectByName("Petites_plantes_des_murets");
      yr && yr.parent.remove(yr);
      const ai = (e, o) => (et.some((r) => ue([e, o], r)) ? 0.35 : Rt(e, o)),
        Vn = MoulinForest(a, { root: _t, ground: ai, surfaces: W, standard: H, rgb: xe, Batch: m });
      ((ca.length = 0),
        ca.push(...globalThis.MoulinHost30.trees),
        ca
          .filter(
            (e) =>
              (!we(e.x, e.z) || e.label !== "Arbre feuillu" || e.id === "arbre-274") &&
              (!ae([e.x, e.z], 1) || et.some((o) => ue([e.x, e.z], o))) &&
              !ue([e.x, e.z], N.forecourt) &&
              se([e.x, e.z], N.drive, !1, 2.3) > 2.3 &&
              se([e.x, e.z], B, !1, 2.5) > 2.5 &&
              se([e.x, e.z], N.rockFace, !1, 2.8) > 2.8 &&
              !jt(e.x, e.z, 1.7) &&
              !(e.x > -27 && e.x < -10 && e.z > -27 && e.z < -4) &&
              Math.hypot(e.x - N.seat.centre[0], e.z - N.seat.centre[1]) > 3,
          )
          .forEach((e) => Vn.add({ ...e, species: MoulinTreeFamily(e) })));
      for (const [e, o] of [
        [-38, -8, 15, "pine"],
        [-38.5, -20, 15.8, "pine"],
        [-34.9, -28.7, 14, "pine"],
        [-31.4, -36, 15, "pine"],
        [-24, -51, 16, "oak"],
        [-15.5, -62, 15, "oak"],
        [-24, -58, 12, "birch"],
        [-26, -64, 13, "birch"],
      ].entries())
        Vn.add({
          id: "arbre-" + (9e3 + e),
          x: o[0],
          z: o[1],
          height: o[2],
          species: o[3],
          diameter: o[3] === "pine" ? 0.5 : 0.44,
          spread: o[3] === "pine" ? 0.62 : 0.77,
          variant: e % 2,
          rotation: e * 1.7,
          label: "Arbre rep\xE8re des photos",
        });
      (Vn.rebuild(), (Ya = Vn.count));
      const Yi = new Set();
      Xe.traverse((e) => {
        var o;
        ((o = e.material) == null ? void 0 : o.map) === W.grass && Yi.add(e.material);
      });
      const vr = { value: 0 };
      ((D.foliage.onBeforeCompile = (e) => {
        ((e.vertexShader = e.vertexShader.replace(
          "#include <lights_lambert_vertex>",
          `#include <lights_lambert_vertex>
#ifdef DOUBLE_SIDED
vLightBack=vLightFront;vIndirectBack=vIndirectFront;
#endif`,
        )),
          (e.uniforms.breezeTime = vr),
          (e.uniforms.breezeStrength20 = {
            get value() {
              return ve;
            },
          }),
          (e.vertexShader =
            `uniform float breezeTime;uniform float breezeStrength20;
` + e.vertexShader),
          (e.vertexShader = e.vertexShader.replace(
            "#include <begin_vertex>",
            `#include <begin_vertex>
float sway=min(.07,position.y*.006)*(sin(position.x*.75+breezeTime*.83)+.45*sin(position.z*.55+breezeTime*1.22));
transformed.x+=sway*breezeStrength20;transformed.z+=sway*.36*breezeStrength20;`,
          )));
      }),
        await te.step("Optimisation du paysage\u2026"),
        MoulinArtDetails(a, {
          model: Xe,
          house: _o,
          annex: Qo,
          materials: D,
          standard: H,
          surfaces: W,
          box: g,
          beam: Io,
          terrainHeight: Rt,
          wetAt: ae,
          Batch: m,
        }));
      const da = MoulinLandscapeStyle(a, {
        model: Xe,
        surfaces: W,
        standard: H,
        rgb: xe,
        terrainHeight: Rt,
        wetAt: ae,
        inside: ue,
        edgeDistance: se,
        waterRegions: Re,
        channels: ee,
        channelSample: ge,
        paths: Se,
        hillWalk: B,
        yard: nn,
        patio: gn,
        pointGarden: J,
        bridges: X.featuresV7.footbridges,
        forest: Vn,
        scope: "all",
        propertyTrails: Ie,
        trailSample: Ct,
      });
      Xe.traverse((e) => {
        e.isMesh && (e.material === D.masonry || e.name === "Dalles_de_la_terrasse") && (e.castShadow = !1);
      });
      const ta = new a.Group();
      ((ta.name = "Parterre_et_mur_arriere_dependance"),
        Mt.add(ta),
        (ta.userData.layout = { wall: Y, bed: E, nicheLocal: N.nicheLocal, source: "Carte annotee 24 septembre" }));
      const ri = new m(D.masonry, "Mur_de_soutenement_3m", ta);
      for (let e = 0; e < Y.length - 1; e++) {
        const o = Y[e],
          r = Y[e + 1],
          s = r[0] - o[0],
          u = r[1] - o[1],
          _ = Math.hypot(s, u),
          L = -Math.atan2(u, s);
        for (let Pe = 0; Pe < 10; Pe++)
          for (let Te = 0; Te < _; Te += 0.73) {
            const it = Math.min(_ - 0.1, Te + 0.36) / _;
            ri.add(
              on,
              [o[0] + s * it, q + 0.34 + (Pe + 0.5) * 0.3, o[1] + u * it],
              [Math.min(0.71, _ - Te), 0.284, 0.64],
              ["#8c8778", "#999180", "#827e70", "#a29985"][(Pe * 3 + Math.floor(Te * 5) + e) % 4],
              [0, L, 0],
            );
          }
        const Ae = g(
          _ + 0.12,
          0.12,
          0.78,
          [(o[0] + r[0]) / 2, q + 3.34, (o[1] + r[1]) / 2],
          H("#93917c", { roughness: 1 }),
          "Couronnement_du_mur",
          ta,
        );
        Ae.rotation.y = L;
      }
      ri.finish();
      const ii = new m(D.masonry, "Bordure_basse_du_parterre", ta);
      for (let e = 0; e < 10; e++) {
        const o = E[e],
          r = E[e + 1],
          s = r[0] - o[0],
          u = r[1] - o[1],
          _ = Math.hypot(s, u);
        for (let L = 0; L < _; L += 0.62)
          for (let Ae = 0; Ae < 2; Ae++) {
            const Pe = Math.min(1, (L + 0.3) / _);
            Math.hypot(o[0] + s * Pe - N.fountain.centre[0], o[1] + u * Pe - N.fountain.centre[1]) < 1.1 ||
              ii.add(
                on,
                [o[0] + s * Pe, q + 0.1 + Ae * 0.24, o[1] + u * Pe],
                [Math.min(0.6, _ - L), 0.225, 0.42],
                Ro[(e + Ae + Math.floor(L)) % Ro.length],
                [0, -Math.atan2(u, s), 0],
              );
          }
      }
      (ii.finish(), uo(E, q + 0.36, H("#625737", { roughness: 1 }), "Terre_du_parterre", ta));
      const si = new m(D.foliage, "Arbustes_du_parterre", ta),
        li = new m(D.foliage, "Fleurs_du_parterre", ta);
      for (let e = 0; e < 200; e++) {
        const o = U(-12.2, -5.9),
          r = U(-14.9, 3.4);
        if (!ue([o, r], E) || Math.hypot(o - N.fountain.centre[0], r - N.fountain.centre[1]) < 1.45) continue;
        const s = U(0.32, 0.78),
          u = ["#527747", "#78924c", "#8e9b57", "#496b40"][e % 4];
        if (
          (si.add(Qe, [o, q + 0.36 + s * 0.62, r], [s * 0.64, s * 0.65, s * 0.6], u, [0, U(0, 6.28), 0]), e % 4 === 0)
        )
          for (let _ = 0; _ < 3; _++)
            li.add(
              G,
              [o + U(-0.2, 0.2), q + 0.38 + s * 0.95 + U(-0.05, 0.1), r + U(-0.2, 0.2)],
              [0.075, 0.07, 0.075],
              e % 3 ? "#dddcc3" : "#cda8a0",
            );
      }
      (si.finish(), li.finish());
      const fa = new a.Group();
      ((fa.name = "Annexe_arriere_9m2"),
        fa.position.set(...N.nicheLocal),
        Qo.add(fa),
        g(3.02, N.nicheLocal[1], 3.02, [0, -N.nicheLocal[1] / 2, 0], D.stone, "Soubassement_de_la_niche", fa),
        g(3, 2.35, 3, [0, 1.175, 0], D.stone, "Murs_petite_annexe", fa),
        Dn(
          fa,
          [
            [-1.68, 2.8, -1.68],
            [-1.68, 2.8, 1.68],
            [1.68, 2.45, 1.68],
            [1.68, 2.45, -1.68],
          ],
          "Toit_annexe_arriere",
        ));
      for (const e of [-1.55, 1.55]) Io([-1.65, 2.78, e], [1.65, 2.43, e], 0.1, 0.13, D.wood, "Rive_bois_annexe", fa);
      Vo(fa, 0, 1.42, 1.54, 1, 1.15, !1, 0, "#4c4637");
      const Ba = new a.Group();
      ((Ba.name = "Sentiers_et_berges_v16"), (Ba.userData.dynamicGround = !0), Xe.add(Ba));
      const Ga = [],
        Fa = [],
        La = [],
        Va = [];
      let ci = 0;
      for (const e of Re)
        for (let o = 0; o < e.poly.length; o++) $a(e.poly[o], e.poly[(o + 1) % e.poly.length], e.level);
      for (const e of ee)
        for (const o of Oo.channels[e.name] || []) {
          const r = o.outer;
          for (let s = 0; s < r.length; s++) {
            const u = r[s],
              _ = r[(s + 1) % r.length],
              L = [(u[0] + _[0]) / 2, (u[1] + _[1]) / 2];
            if (Re.some((Te) => ue(L, Te.poly) || se(L, Te.poly, !0, 0.6) < 0.6)) continue;
            // V32 : pas de lèvre de terre régulière le long des tronçons naturels.
            if (globalThis.MoulinV32.riverbeds && globalThis.MoulinV32.riverbeds.natural(e, ge(L, e).along) > 0.35) continue;
            const Ae = ge(u, e),
              Pe = ge(_, e);
            Math.abs(Ae.height - Pe.height) > 0.1 || $a(u, _, Ae.height, e, Pe.height);
          }
        }
      const Ki = ui(Ga, Fa, "Tranche_de_terre_10cm"),
        Qi = ui(La, Va, "Levre_herbeuse_des_berges"),
        Ji = H("#c7b699", {
          map: W.leafLitter,
          roughness: 1,
          side: a.DoubleSide,
          vertexColors: !0,
          polygonOffset: !0,
          polygonOffsetFactor: -2,
        }),
        wr = [];
      for (const e of Ie) {
        let Ae = function (Ue, wt) {
          const St = [];
          for (let Nt = 0; Nt < Ue.length; Nt++) {
            const Mo = Ue[Nt],
              so = Ue[(Nt + 1) % Ue.length],
              no = wt(Mo),
              Lo = wt(so);
            if ((no >= 0 && St.push(Mo), no >= 0 != Lo >= 0)) {
              const lo = no / (no - Lo);
              St.push(Mo.map((Zo, Ht) => Zo + (so[Ht] - Zo) * lo));
            }
          }
          return St;
        };
        if (e.name === "Montee_vers_la_chaise") continue;
        const o = [],
          r = [],
          s = [],
          u = qt.mesh.geometry.attributes.position,
          _ = qt.mesh.geometry.index.array,
          L = e.points.slice(0, -1).map((Ue, wt) => {
            const St = e.points[wt + 1],
              Nt = St[0] - Ue[0],
              Mo = St[1] - Ue[1],
              so = Math.hypot(Nt, Mo);
            return {
              a: Ue,
              dx: Nt / so,
              dz: Mo / so,
              len: so,
              half: e.width * 0.5,
              minX: Math.min(Ue[0], St[0]) - e.width,
              maxX: Math.max(Ue[0], St[0]) + e.width,
              minZ: Math.min(Ue[1], St[1]) - e.width,
              maxZ: Math.max(Ue[1], St[1]) + e.width,
            };
          }),
          Pe = xe("#ffffff"),
          Te = qt.renderCells.filter((Ue) =>
            L.some((wt) => Ue.x <= wt.maxX && Ue.x + 1.4 >= wt.minX && Ue.z <= wt.maxZ && Ue.z + 1.4 >= wt.minZ),
          );
        for (const Ue of Te)
          for (let wt = Ue.start; wt < Ue.end; wt += 3) {
            const St = [_[wt], _[wt + 1], _[wt + 2]],
              Nt = St.map((lo) => [u.getX(lo), u.getY(lo), u.getZ(lo)]),
              Mo = Math.min(Nt[0][0], Nt[1][0], Nt[2][0]),
              so = Math.max(Nt[0][0], Nt[1][0], Nt[2][0]),
              no = Math.min(Nt[0][2], Nt[1][2], Nt[2][2]),
              Lo = Math.max(Nt[0][2], Nt[1][2], Nt[2][2]);
            for (const lo of L) {
              if (Mo > lo.maxX || so < lo.minX || no > lo.maxZ || Lo < lo.minZ) continue;
              const Zo = (to) => (to[0] - lo.a[0]) * lo.dx + (to[2] - lo.a[1]) * lo.dz,
                Ht = (to) => -(to[0] - lo.a[0]) * lo.dz + (to[2] - lo.a[1]) * lo.dx;
              let $t = Ae(Nt, (to) => Zo(to));
              if (
                $t.length &&
                (($t = Ae($t, (to) => lo.len - Zo(to))),
                !!$t.length && (($t = Ae($t, (to) => lo.half - Ht(to))), !!$t.length))
              ) {
                $t = Ae($t, (to) => lo.half + Ht(to));
                for (let to = 1; to < $t.length - 1; to++)
                  for (const Wo of [$t[0], $t[to], $t[to + 1]])
                    (o.push(Wo[0], Wo[1] + 0.032, Wo[2]), r.push(Wo[0] * 0.8, Wo[2] * 0.8), s.push(Pe.r, Pe.g, Pe.b));
              }
            }
          }
        const it = new a.BufferGeometry();
        (it.setAttribute("position", new a.Float32BufferAttribute(o, 3)),
          it.setAttribute("uv", new a.Float32BufferAttribute(r, 2)),
          it.setAttribute("color", new a.Float32BufferAttribute(s, 3)),
          it.computeVertexNormals());
        const dt = F(it, Ji, e.name, Ba);
        ((dt.castShadow = !1), wr.push(dt));
      }
      const Ei = da.resettle;
      ((da.resettle = () => {
        var e, o;
        (Ei(), $i(), (o = (e = Xe.userData).gardenResettle25) == null || o.call(e));
      }),
        (da.siteStats = {
          bankSegments: ci,
          bankFreeboard: 0.1,
          retainingHeight: 3,
          annexArea: 9,
          wall: Y,
          bed: E,
          nicheLocal: N.nicheLocal,
          lawns: N.lawns.map((e) => ({ name: e.name, poly: e.poly })),
          trails: Ie.map((e) => ({
            name: e.name,
            width: e.width,
            points: e.points,
            levels: e.levels || e.points.map((o) => +Rt(...o).toFixed(3)),
          })),
        }));
      const jn = new a.Group();
      ((jn.name = "Cour_rocaille_et_camelias_v16"), Mt.add(jn));
      const Ti = N.upperTerraceParts.map((e) => {
          const o = new a.Shape(e.outer.map((r) => new a.Vector2(r[0], -r[1])));
          for (const r of e.holes) o.holes.push(new a.Path(r.map((s) => new a.Vector2(s[0], -s[1]))));
          return o;
        }),
        ya = new a.ShapeGeometry(Ti);
      (ya.rotateX(-Math.PI / 2), oo(ya, 0.47));
      const di = [],
        Mr = qt.mesh.geometry.attributes.position,
        xr = qt.mesh.geometry.attributes.color;
      for (let e = 0; e < ya.attributes.position.count; e++) {
        const o = ya.attributes.position.getX(e),
          r = ya.attributes.position.getZ(e);
        let s = 0,
          u = 1 / 0;
        for (let _ = 0; _ < Mr.count; _++) {
          const L = Mr.getX(_) - o,
            Ae = Mr.getZ(_) - r,
            Pe = L * L + Ae * Ae;
          Pe < u && ((u = Pe), (s = _));
        }
        di.push(xr.getX(s), xr.getY(s), xr.getZ(s));
      }
      ya.setAttribute("color", new a.Float32BufferAttribute(di, 3));
      const fi = F(ya, D.grass, "Sol_plein_du_palier_derriere_le_mur", jn);
      ((fi.position.y = q + 3.215), (fi.castShadow = !1));
      const hi = H("#9b9a8c", { map: W.gravel, roughness: 1, normalScale: new a.Vector2(0, 0) });
      uo(N.forecourt, q + 0.025, hi, "Grande_cour_beton_du_carport", jn);
      const _r = [
        [-4.35, -8.4],
        [-2.1, -12.2],
        [6.8, -10.1],
        [5.8, -7.1],
      ];
      uo(_r, q + 0.027, hi, "Dalle_sous_carport", jn);
      const pi = new m(H("#66685e", { vertexColors: !0, roughness: 1 }), "Joints_discrets_cour", jn);
      for (const e of [-12.3, -17.2, -22])
        for (let o = -6.5; o < 8.7; o += 0.22)
          ue([o, e], N.forecourt) && pi.add(So, [o, q + 0.031, e], [0.23, 0.002, 0.016], "#77796e");
      pi.finish();
      const mi = new m(D.metal, "Caniveau_entre_cour_et_passage", jn);
      for (let e = -6.2; e < -1.8; e += 0.12) mi.add(So, [e, q + 0.048, -9.1], [0.055, 0.028, 0.32], "#404b46");
      (mi.finish(), N.cars.forEach(ts));
      const Sr = new a.Group();
      ((Sr.name = "Rocaille_dans_le_prolongement_du_mur"), jn.add(Sr));
      const Rn = new a.Group();
      ((Rn.name = "Chemins_et_jardin_de_colline_v17"), jn.add(Rn));
      const gi = H("#ffffff", { vertexColors: !0, map: W.stone, roughness: 1, flatShading: !0, metalness: 0 }),
        bi = H("#ffffff", { vertexColors: !0, roughness: 1, flatShading: !0, metalness: 0 }),
        os = H("#5d8477", { roughness: 0.83, metalness: 0.1 }),
        Ia = ["#85877b", "#777c70", "#98907b", "#a19783", "#6b7568"];
      let kr = 27641;
      const va = new a.BoxGeometry(1, 1, 1),
        Na = va.attributes.position;
      for (let e = 0; e < Na.count; e++) {
        const o = Na.getX(e),
          r = Na.getY(e),
          s = Na.getZ(e),
          u = Math.sin(o * 24 + r * 43 + s * 56);
        Na.setXYZ(e, o * (0.95 + 0.07 * u), r * (0.96 + 0.04 * u), s * (0.96 + 0.04 * u));
      }
      va.computeVertexNormals();
      const yi = new m(bi, "Strates_rocheuses_au_pied_du_jardin", Sr);
      for (let e = 0; e < N.rockFace.length - 1; e++) {
        const o = N.rockFace[e],
          r = N.rockFace[e + 1],
          s = r[0] - o[0],
          u = r[1] - o[1],
          _ = Math.hypot(s, u),
          L = -u / _,
          Ae = s / _,
          Pe = -Math.atan2(u, s);
        for (let Te = 0.38; Te < 3.15; Te += 0.44)
          for (let it = -0.3 + (Math.floor(Te * 3) % 2) * 0.7; it < _; ) {
            const dt = Math.min(qo(0.9, 1.8), _ - it + 0.18),
              Ue = (it + dt * 0.5) / _,
              wt = o[0] + s * Ue - L * Te * 0.12,
              St = o[1] + u * Ue - Ae * Te * 0.12;
            (!jt(wt, St, 1.02) &&
              Math.hypot(wt - N.fountain.centre[0], St - N.fountain.centre[1]) > 1 &&
              yi.add(va, [wt, q + Te, St], [dt, 0.49 + qo(-0.035, 0.035), 1 + qo(0, 0.3)], Ia[Math.floor(qo(0, 5))], [
                qo(-0.045, 0.045),
                Pe + qo(-0.07, 0.07),
                qo(-0.05, 0.05),
              ]),
              (it += dt - 0.035));
          }
      }
      yi.finish();
      const Sa = [],
        zr = new m(gi, "Marches_irregulieres_et_pas_de_pierre", Rn),
        Ar = [],
        Cr = H("#cbc5ae", {
          map: W.leafLitter,
          roughness: 1,
          side: a.DoubleSide,
          transparent: !0,
          depthWrite: !1,
          opacity: 0.86,
          polygonOffset: !0,
          polygonOffsetFactor: -1,
        });
      ((Cr.onBeforeCompile = (e) => {
        e.fragmentShader = e.fragmentShader.replace(
          "#include <alphatest_fragment>",
          `diffuseColor.a *= smoothstep(0.0, 0.19, min(vUv.x, 1.0-vUv.x));
#include <alphatest_fragment>`,
        );
      }),
        (Cr.customProgramCacheKey = () => "soft-needle-edge-v17"));
      const bs = [];
      for (const e of N.hillRoutes) {
        ns(e);
        for (let o = 0; o < e.points.length - 1; o++) {
          const r = e.points[o],
            s = e.points[o + 1],
            u = s[0] - r[0],
            _ = s[1] - r[1],
            L = Math.hypot(u, _),
            Ae = e.levels[o],
            Pe = e.levels[o + 1],
            Te = ((t = e.kinds) == null ? void 0 : t[o]) || "path",
            it = Te === "steps" ? e.counts[o] : Math.ceil(L / 1.32);
          if (Te === "steps")
            for (let dt = 0; dt < it; dt++) {
              const Ue = (dt + 0.5) / it,
                wt = r[0] + u * Ue,
                St = r[1] + _ * Ue,
                Nt = Ae + ((Pe - Ae) * (dt + 1)) / it + 0.045,
                Mo = L / it + 0.03,
                so = e.width + qo(-0.07, 0.07);
              (zr.add(va, [wt, Nt - 0.11, St], [so, 0.22, Mo + 0.025], Ia[(o + dt) % 5], [0, Math.atan2(u, _), 0]),
                Sa.push({
                  x: wt,
                  z: St,
                  y: Nt,
                  dx: u / L,
                  dz: _ / L,
                  length: Mo,
                  width: e.width,
                  route: e.name,
                  segment: o,
                }));
            }
          else if (e === N.hillRoutes[0])
            for (let dt = 0; dt < it; dt++) {
              const Ue = (dt + 0.4) / it,
                wt = r[0] + u * Ue,
                St = r[1] + _ * Ue,
                Nt = Rt(wt, St) + 0.05;
              zr.add(va, [wt, Nt, St], [qo(0.65, 1.06), 0.095, qo(0.4, 0.64)], Ia[(o + dt) % 5], [
                0,
                Math.atan2(u, _) + qo(-0.13, 0.13),
                0,
              ]);
            }
        }
      }
      zr.finish();
      const ja = [],
        Pr = new m(gi, "Murets_de_schiste_du_chemin_et_de_l_entree", Rn);
      for (const e of N.hillWalls)
        for (let o = 0; o < e.points.length - 1; o++) {
          const r = e.points[o],
            s = e.points[o + 1],
            u = s[0] - r[0],
            _ = s[1] - r[1],
            L = Math.hypot(u, _),
            Ae = -Math.atan2(_, u);
          for (let Pe = 0; Pe < 3; Pe++)
            for (let Te = 0; Te < L; ) {
              const it = Math.min(qo(0.44, 0.92), L - Te),
                dt = (Te + it / 2) / L,
                Ue = r[0] + u * dt,
                wt = r[1] + _ * dt,
                St = Rt(Ue, wt) - 0.045;
              (Pr.add(
                va,
                [Ue, St + (e.height * (Pe + 0.5)) / 3, wt],
                [it + 0.016, e.height / 3 + 0.012, e.width + qo(-0.035, 0.035)],
                Ia[(o + Pe + Math.floor(Te * 4)) % 5],
                [0, Ae + qo(-0.025, 0.025), 0],
              ),
                Pe === 2 &&
                  (ja.push({ x: Ue, z: wt, y: St + e.height, width: e.width, length: it, dx: u / L, dz: _ / L }),
                  Pr.add(va, [Ue, St + e.height + 0.035, wt], [it + 0.02, 0.09, e.width + 0.1], "#b1ab93", [0, Ae, 0])),
                (Te += it));
            }
        }
      Pr.finish();
      const vi = new m(H("#ffffff", { vertexColors: !0, roughness: 0.88 }), "Rampes_vertes_de_l_entree", Rn),
        Ea = N.hillRoutes[0].points[1],
        wi = N.hillRoutes[0].points[2],
        Dr = wi[0] - Ea[0],
        Br = wi[1] - Ea[1],
        Mi = Math.hypot(Dr, Br);
      for (const e of [-1, 1]) {
        let o = null;
        for (let r = 0; r <= 4; r++) {
          const s = r / 4,
            u = Ea[0] + Dr * s - (Br / Mi) * 0.71 * e,
            _ = Ea[1] + Br * s + (Dr / Mi) * 0.71 * e,
            L = 1.1 + 1.65 * s;
          (vi.add(So, [u, L + 0.44, _], [0.042, 0.9, 0.042], "#63947d"),
            o && Io(o, [u, L + 0.9, _], 0.039, 0.039, os, "Main_courante_vert_patine", Rn),
            (o = [u, L + 0.9, _]));
        }
      }
      vi.finish();
      const ha = new a.Group();
      ((ha.name = "Arche_de_camelias_sur_l_escalier"),
        ha.position.set(N.camellia.centre[0], 1.92, N.camellia.centre[1]),
        (ha.rotation.y = Math.atan2(N.camellia.direction[0], N.camellia.direction[1])),
        Rn.add(ha));
      const Gr = new m(D.foliage, "Camelias_en_voute_naturelle", ha);
      for (const e of [-1, 1]) {
        for (let o = 0; o < 30; o++) {
          const r = qo(-1.45, 1.45),
            s = e * qo(1.05, 2.1),
            u = qo(0.25, 2.6),
            _ = qo(0.34, 0.62);
          Gr.add(Qe, [s, u, r], [_, _ * 0.85, _], ["#315c37", "#3c683e", "#477244", "#59783e"][o % 4], [
            0,
            qo(0, 6.28),
            0,
          ]);
        }
        (Io([e * 0.97, -0.3, 0.45], [e * 0.86, 1.9, 0.15], 0.105, 0.115, D.wood, "Tige_de_camelia", ha),
          e === 1 &&
            Io([-0.88, 2.03, -0.4], [1.12, 2.19, 0.1], 0.085, 0.072, D.wood, "Branche_au_dessus_de_la_rampe", ha));
      }
      for (let e = 0; e < 25; e++) {
        const o = qo(-1.2, 1.2),
          r = qo(-1.4, 1.4),
          s = 2.6 + qo(-0.1, 0.3);
        Gr.add(Qe, [o, s, r], [qo(0.34, 0.52), 0.35, qo(0.34, 0.52)], ["#355e37", "#486f3b", "#53753c"][e % 3], [
          0,
          e * 0.71,
          0,
        ]);
      }
      (Gr.finish(), (ha.userData.clearOpening = { width: 1.34, height: 2.03 }));
      const xi = H("#a27a59", { roughness: 1 });
      for (const [e, o, r] of [
        [-14.7, -9.2, 1],
        [-16.4, -6.5, 1.1],
        [-20.35, -12, 1.2],
        [-22.6, -20.5, 0.95],
      ])
        as(e, o, r);
      const _i = new m(D.foliage, "Massifs_et_bruyeres_de_la_colline", Rn),
        Si = [
          [-15.5, -12.1, 1.25],
          [-16.7, -10.9, 1.4],
          [-16, -14, 1.1],
          [-15.2, -5.9, 1],
          [-19.6, -8.6, 1.15],
          [-21.6, -12.7, 1.4],
          [-22.5, -16.3, 1.3],
          [-24, -20, 1.15],
          [-27.5, -22, 1],
          [-32, -16, 1.2],
          [-38, -18, 1.1],
          [-32.3, -7.4, 0.8],
          [-30.3, -35, 1],
          [-26, -43, 1.1],
          [-23.5, -50, 1.2],
          [-25, -5.5, 0.9],
          [-22, -3.3, 1],
          [-20, -5.5, 0.9],
        ];
      for (let e = 0; e < Si.length; e++) {
        const [o, r, s] = Si[e];
        if (jt(o, r, 0.8)) continue;
        const u = Rt(o, r),
          _ = ["#4d7045", "#6b7c4b", "#9e6851", "#537861", "#708b46", "#8e7950"][e % 6];
        for (let L = 0; L < 5; L++) {
          const Ae = L * 2.4,
            Pe = s * 0.4;
          _i.add(
            Qe,
            [o + Math.cos(Ae) * Pe, u + s * 0.47 + qo(0, 0.25), r + Math.sin(Ae) * Pe],
            [s * 0.48, s * 0.5, s * 0.48],
            _,
            [0, L + e, 0],
          );
        }
      }
      _i.finish();
      const ki = new m(
          H("#ffffff", { vertexColors: !0, roughness: 1, side: a.DoubleSide }),
          "Fougeres_et_phormiums_de_la_rocaille",
          Rn,
        ),
        zi = new m(bi, "Pierres_et_lichens_sur_la_pente", Rn);
      for (let e = 0; e < 90; e++) {
        const o = qo(-40, -10),
          r = qo(-34, -3);
        if (jt(o, r, 0.7) || ue([o, r], N.upperTerrace) || w.some((u) => be(o, r, u) < 1)) continue;
        const s = Rt(o, r);
        e % 3 === 0 &&
          zi.add(Qe, [o, s - 0.15, r], [qo(0.35, 0.66), qo(0.2, 0.34), qo(0.32, 0.58)], Ia[e % 5], [
            0,
            qo(0, 6.28),
            qo(-0.1, 0.1),
          ]);
        for (let u = 0; u < 6; u++)
          ki.add(
            Da,
            [o + 0.28, s + 0.03, r + 0.38],
            [qo(4, 8), qo(0.36, 0.8), qo(0.4, 0.95)],
            ["#698347", "#808250", "#537545", "#999468"][e % 4],
            [0, u * 1.06 + e, 0.13],
          );
      }
      (ki.finish(), zi.finish());
      const Wn = new a.Group();
      ((Wn.name = "Fauteuil_tresse_gris_sous_les_pins"),
        Wn.position.set(N.seat.centre[0], Rt(...N.seat.centre) + 0.015, N.seat.centre[1]),
        (Wn.rotation.y = N.seat.angle),
        Rn.add(Wn));
      const Fr = H("#a8aba9", { roughness: 0.97 }),
        Ta = new m(H("#ffffff", { vertexColors: !0, roughness: 1 }), "Tressage_gris_du_fauteuil", Wn);
      g(0.83, 0.12, 0.72, [0, 0.43, 0], Fr, "Assise_du_fauteuil_tresse", Wn);
      for (const e of [-0.36, 0.36])
        for (const o of [-0.3, 0.3]) {
          const r = Math.cos(Wn.rotation.y),
            s = Math.sin(Wn.rotation.y),
            u = Wn.position.x + e * r + o * s,
            _ = Wn.position.z - e * s + o * r,
            L = Rt(u, _) - Wn.position.y - 0.025;
          g(0.08, 0.39 - L, 0.075, [e, (0.39 + L) / 2, o], Fr, "Pied_du_fauteuil_tresse", Wn);
        }
      for (let e = 0; e < 15; e++) {
        const o = -0.43 + e * 0.061,
          r = 0.84 + 0.26 * Math.sqrt(Math.max(0, 1 - (o / 0.45) ** 2));
        Ta.add(
          So,
          [o, (r + 0.45) / 2, -0.37 + 0.18 * (o / 0.45) ** 2],
          [0.025, r - 0.45, 0.026],
          e % 2 ? "#c0c3bd" : "#8f9695",
        );
      }
      for (let e = 0; e < 10; e++) {
        const o = 0.5 + e * 0.052;
        for (let r = 0; r < 8; r++) {
          const s = -0.39 + r * 0.112;
          Ta.add(So, [s, o, -0.37 + 0.18 * (s / 0.45) ** 2], [0.114, 0.018, 0.025], e % 2 ? "#afb5b2" : "#929a97", [
            0,
            -s * 0.85,
            0,
          ]);
        }
      }
      for (const e of [-0.43, 0.43]) {
        g(0.075, 0.06, 0.77, [e, 0.75, 0], Fr, "Accoudoir_tresse", Wn);
        for (let o = 0; o < 10; o++) Ta.add(So, [e, 0.59, -0.3 + o * 0.067], [0.018, 0.29, 0.023], "#adb3af");
      }
      Ta.finish();
      const Kn = new a.Group();
      Kn.name = "Petite_fontaine_au_pied_de_la_rocaille";
      const er = N.fountain;
      (Kn.position.set(er.centre[0], er.baseLevel, er.centre[1]), (Kn.rotation.y = er.angle), jn.add(Kn));
      const Ci = H("#888674", { roughness: 1 }),
        rs = H("#293b32", { roughness: 1 });
      g(1.16, 0.64, 0.34, [0, 0.37, 0], Ci, "Dos_de_fontaine", Kn);
      const ka = new a.Shape();
      (ka.moveTo(-0.34, 0.18),
        ka.lineTo(0.34, 0.18),
        ka.lineTo(0.34, 0.63),
        ka.absarc(0, 0.63, 0.34, 0, Math.PI, !1),
        ka.lineTo(-0.34, 0.18));
      const is = F(new a.ShapeGeometry(ka), rs, "Renfoncement_en_arche", Kn);
      is.position.z = 0.179;
      const Lr = new m(D.masonry, "Voussoirs_fontaine", Kn);
      for (let e = 0; e < 9; e++) {
        const o = (e / 8) * Math.PI;
        Lr.add(
          So,
          [Math.cos(o) * 0.46, 0.65 + Math.sin(o) * 0.46, 0.11],
          [0.24, 0.24, 0.33],
          ["#8c8874", "#a29a82", "#797969"][e % 3],
          [0, 0, o],
        );
      }
      for (const e of [-1, 1])
        for (let o = 0; o < 3; o++) Lr.add(So, [e * 0.47, 0.24 + o * 0.17, 0.11], [0.24, 0.165, 0.33], "#98917a");
      (Lr.finish(),
        g(0.86, 0.17, 0.53, [0, 0.15, 0.34], Ci, "Bassin_bas_fontaine", Kn),
        g(0.64, 0.025, 0.33, [0, 0.247, 0.36], H("#315454", { roughness: 0.4 }), "Eau_du_bassin_fontaine", Kn));
      const Pi = F(new a.CylinderGeometry(0.022, 0.025, 0.16, 6), D.metal, "Bec_de_fontaine", Kn);
      ((Pi.rotation.x = Math.PI / 2), Pi.position.set(0, 0.57, 0.23));
      const Di = F(
        new a.CylinderGeometry(0.012, 0.016, 0.25, 5),
        H("#b3cdc0", { transparent: !0, opacity: 0.6, roughness: 0.36 }),
        "Filet_d_eau_fontaine",
        Kn,
      );
      (Di.position.set(0, 0.39, 0.3),
        (Di.castShadow = !1),
        (jn.userData.sources = ["IMG_0243", "IMG_0242", "IMG_0241", "IMG_0240", "IMG_0239", "IMG_7918", "DJI_0028"]));
      const ss = MoulinFinish20(a, { model: Xe, surfaces: W, materials: D, forest: Vn });
      Ke = MoulinDetails29(a, { model: Xe, standard: H, rgb: xe, materials: D });
      let wa = MoulinBirds(a, {
        model: Xe,
        standard: H,
        waterLevel: vt[0].level,
        inside: ue,
        pond: vt[0].poly,
        islands: et,
        terrainHeight: Rt,
        cameraSupportHeight: Nn,
        wetAt: ae,
        foundationFootprints: w,
        footprintDistance: be,
      });
      await te.step("Passages et acc\xE8s au moulin\u2026");
      const yn = MoulinWorld22(a, {
        model: Xe,
        house: _o,
        data: X,
        bridgeCentre: M,
        xy: He,
        siteLayout: N,
        trailMeshes: wr,
        pathSurfaces: Ar,
        materials: D,
        FLOOR: q,
        polygonMesh: uo,
        architecture: Mt,
        terrainHeight: Rt,
        terrainData: qt,
        standard: H,
        inside: ue,
      });
      (MoulinGarden25(a, {
        world: yn,
        model: Xe,
        architecture: Mt,
        terrainHeight: Rt,
        terrainData: qt,
        materials: D,
        surfaces: W,
        standard: H,
        forest: Vn,
        channels: ee,
        wetAt: ae,
        inside: ue,
        siteLayout: N,
      }),
        MoulinSteppingStones26(a, {
          world: yn,
          model: Xe,
          architecture: Mt,
          channels: ee,
          channelSample: ge,
          standard: H,
          surfaces: W,
        }));
      const ls = MoulinCatalog22.prepare(a, { model: Xe }),
        ys = { materials: 0, replacedBy: "continuous-turf26" },
        cs = MoulinPrepareWheel20(a, Xe);
      await te.step("Pr\xE9paration du rendu\u2026");
      const Ma = MoulinRenderCache(a, { model: Xe, terrainData: qt }),
        tr = MoulinWaterEffects20(a, {
          model: Xe,
          architecture: Mt,
          terrainHeight: Rt,
          waterRegions: Re,
          channels: ee,
          channelSample: ge,
          wetAt: ae,
          inside: ue,
          edgeDistance: se,
          surfaces: W,
          materials: D,
          standard: H,
          rgb: xe,
          waterMeshes: io,
          waterEffects: po,
          waterClock: ao,
          root: T,
          mobile: O,
          wheel: cs,
        }),
        qn = new a.Scene();
      ((qn.background = xe("#d9e5e7")), qn.add(Xe), await te.step("Ouverture de la vue 3D\u2026"));
      const xo = new a.WebGLRenderer(
        Object.assign(
          { antialias: !O, alpha: !1, preserveDrawingBuffer: !1, powerPreference: "low-power" },
          globalThis.MoulinHost30.renderer,
        ),
      );
      (globalThis.MoulinV32.render.attach(xo, { mobile: O }),
        xo.setPixelRatio(Math.min(window.devicePixelRatio || 1, O ? 1.75 : 1.5)),
        (xo.outputEncoding = a.sRGBEncoding),
        (xo.toneMapping = a.ACESFilmicToneMapping),
        (xo.toneMappingExposure = 0.9),
        (xo.shadowMap.enabled = !0),
        (xo.shadowMap.type = a.PCFSoftShadowMap),
        (xo.shadowMap.autoUpdate = !1),
        (xo.shadowMap.needsUpdate = !0));
      const Ra = 512,
        or = 256,
        Vr = new Uint8Array(Ra * or * 4);
      for (let e = 0; e < or; e++)
        for (let o = 0; o < Ra; o++) {
          const r = e / (or - 1),
            s = Math.min(1, Math.abs(r - 0.5) * 2),
            u = W.noise(o * 0.024, e * 0.04) * W.noise(o * 0.063, e * 0.08),
            _ = r < 0.5 ? [194, 210, 210] : [124, 139, 112],
            L = r < 0.5 ? [128, 165, 185] : [70, 84, 62],
            Ae = Math.max(0, u - 0.31) * 38 * (r < 0.5 ? 1 : 0.1);
          for (let Pe = 0; Pe < 3; Pe++) Vr[(e * Ra + o) * 4 + Pe] = _[Pe] * (1 - s) + L[Pe] * s + Ae;
          Vr[(e * Ra + o) * 4 + 3] = 255;
        }
      const nr = new a.DataTexture(Vr, Ra, or, a.RGBAFormat);
      if (
        ((nr.encoding = a.sRGBEncoding), (nr.mapping = a.EquirectangularReflectionMapping), (nr.needsUpdate = !0), !O)
      ) {
        const e = new a.PMREMGenerator(xo);
        ((qn.environment = e.fromEquirectangular(nr).texture), e.dispose());
      }
      (le.appendChild(xo.domElement),
        xo.domElement.setAttribute("role", "img"),
        xo.domElement.setAttribute(
          "aria-label",
          "Maquette 3D du moulin en pierre, de ses trois \xE9tangs et de la vall\xE9e bois\xE9e.",
        ));
      const ko = new a.PerspectiveCamera(39, 1, 0.08, 1800),
        Fo = new a.OrbitControls(ko, xo.domElement);
      ((Fo.enableDamping = !0),
        (Fo.dampingFactor = 0.09),
        (Fo.minDistance = 1.8),
        (Fo.maxDistance = 900),
        (Fo.maxPolarAngle = Math.PI * 0.493),
        Fo.target.set(-27, 5, 43),
        (Fo.screenSpacePanning = !1));
      const Ir = new a.HemisphereLight(13032950, 9868683, 0.68);
      qn.add(Ir);
      const $o = new a.DirectionalLight(16773858, 2.12);
      ($o.position.set(-65, 98, 62),
        $o.target.position.set(-45, 0, 60),
        qn.add($o, $o.target),
        ($o.castShadow = !0),
        $o.shadow.mapSize.set(O ? 1024 : 2048, O ? 1024 : 2048),
        ($o.shadow.camera.left = -255),
        ($o.shadow.camera.right = 255),
        ($o.shadow.camera.top = 215),
        ($o.shadow.camera.bottom = -215),
        ($o.shadow.camera.near = 1),
        ($o.shadow.camera.far = 650),
        ($o.shadow.bias = -16e-5),
        ($o.shadow.normalBias = 0.045),
        ($o.shadow.radius = 3));
      const ar = new a.DirectionalLight(12769520, 0.17);
      (ar.position.set(170, 80, -50), qn.add(ar));
      let Uo = null,
        Qn = "balanced",
        Nr = 30,
        rr = !0;
      const In = { frames: 0, draws: 0, triangles: 0, renderMs: 0, reflections: 0, targetFPS: 30 };
      let Po = !0,
        us = !1,
        Jn = null,
        Wa = "jeu",
        oa = !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        qa = 0;
      (T.querySelector("[data-quality]").addEventListener("change", (e) => jr(e.target.value)),
        jr(O ? "fast" : "balanced"),
        T.querySelector("[data-motion]").setAttribute("aria-pressed", String(oa)));
      const $n = {
        rocaille: { position: [0.4, 3.9, -20.8], target: [-13, 3.55, -4.2], fov: 65 },
        cour: { position: [-1.6, 5.4, -30.5], target: [0.3, 2.4, -13.2], fov: 67 },
        hautmur: { position: [-28.5, 11, -7.5], target: [-5.6, 4.5, 2], fov: 62 },
        escalier: { position: [0.5, 3.5, -24.6], target: [-9.1, 3.3, -16.5], fov: 54 },
        hydrologie: { position: [48, 234, 30.001], target: [48, 0, 30], fov: 58, cutaway: !0 },
        petitbassin: { position: [-94, 11, 94], target: [-107, -0.05, 113], fov: 55 },
        fontaine: { position: [-2.7, 2.6, -14.7], target: [-7.3, 1.8, -13.5], fov: 49 },
        arriere: { position: [-3.9, 6.7, -7.2], target: [-16.8, 4, -1.3], fov: 65 },
        implantation: { position: [-12, 85, 6.001], target: [-12, 0, 6], fov: 43, cutaway: !0 },
        pelouses: { position: [-39, 194, 60.001], target: [-39, 0, 60], fov: 57 },
        rive: { position: [5, 4.2, 60], target: [28, 2.8, 40], fov: 63 },
        sentiers: { position: [-53, 12, 53], target: [-71, 4.4, 38], fov: 57 },
        eau: { position: [-24, 2.3, 42], target: [-37, 0.1, 54], fov: 56 },
        jeu: { position: [-2, 19.5, 43], target: [-5, 2, 12], fov: 45 },
        ambiance: { position: [20, 8.5, 44], target: [-3, 7.5, 0], fov: 58 },
        promenade: { position: [-4, 3.1, 14], target: [9, 3, 4], fov: 65 },
        oiseaux: { position: [-8, 6, 63], target: [-20, 0.4, 52], fov: 52 },
        terrasse: { position: [21, 19, 40], target: [3.8, 2.2, 5.7], fov: 49 },
        photo: { position: [8, 30, 45], target: [11, 1.7, -5], fov: 49 },
        roue: { position: [13, 5.9, 9], target: [3.8, 1.7, 5.9], fov: 49 },
        vannes: { position: [29, 19, 38], target: [9, 1, 11], fov: 48 },
        jardins: { position: [7, 37, -41], target: [44, 0.8, -20], fov: 49, cutaway: !0 },
        colline: { position: [-5, 68, 24], target: [-19, 4, -23], fov: 49, cutaway: !0 },
        facade: { position: [-26, 5.1, 25], target: [-25, 3.6, 6.5], fov: 58 },
        drone: { position: [170, 170, -130], target: [12, 1, 20], fov: 50 },
        ensemble: { position: [-240, 470, 360], target: [-50, 5, 65], fov: 43 },
        moulin: { position: [38, 35, 60], target: [-7, 3, 11], fov: 45 },
        dependance: { position: [4, 25, 29], target: [-19, 4, 0], fov: 46 },
        pont: { position: [-118, 8, 115], target: [-103, 0.2, 105], fov: 49 },
        veranda: { position: [18, 8, -3], target: [5, 2.5, -1], fov: 52 },
        bief: { position: [4, 8, 26], target: [4.6, 0.7, 12.7], fov: 49 },
        riviere: { position: [144, 200, 44], target: [66, 0, -11], fov: 45 },
        etage: { position: [-2.1, 7, 7.8], target: [-29, 2, 58], fov: 67 },
        plan: { position: [-31, 486, 45.01], target: [-31, 0, 45], fov: 43 },
      };
      Object.assign($n, {
        rocaille: { position: [0.4, 3.9, -20.8], target: [-13, 3.55, -4.2], fov: 65 },
        cour: { position: [-1.6, 5.4, -30.5], target: [0.3, 2.4, -13.2], fov: 67 },
        hautmur: { position: [-28.5, 11, -7.5], target: [-5.6, 4.5, 2], fov: 62 },
        escalier: { position: [-3.1, 2.8, -18.6], target: [-11.3, 3.2, -16.3], fov: 54 },
        hydrologie: { position: [48, 234, 30.001], target: [48, 0, 30], fov: 58, cutaway: !0 },
        petitbassin: { position: [-94, 11, 94], target: [-107, -0.05, 113], fov: 55 },
        fontaine: { position: [-2.7, 2.6, -14.7], target: [-7.3, 1.8, -13.5], fov: 49 },
        paliers: { position: [-12.15, 4.8, -12.9], target: [-14.5, 4.55, -6.6], fov: 62 },
        colline: { position: [-1.5, 22, -29], target: [-22, 6, -12], fov: 57 },
        fauteuil: { position: [-39, 12.2, -11.7], target: [-29, 7.5, -1], fov: 64 },
        sousbois: { position: [-25.5, 11.9, -41], target: [-19, 11.2, -60], fov: 66 },
        entree: { position: [-1.9, 5.1, -45.5], target: [-1, 2.7, -17], fov: 62 },
        terrasse: { position: [-9.5, 11, 21.5], target: [-3, 1.8, 11.5], fov: 52 },
        bois: { position: [-94, 6, 100], target: [-103, 1, 106], fov: 56 },
      });
      const za = new a.Box3().setFromObject(Xe);
      let Un = null,
        Gi = new a.Vector3(1 / 0, 0, 0),
        Fi = 0;
      (($n.depart23 = { position: [-5, 10, -94], target: [2, 4, -81], fov: 60 }),
        ($n.cosy20 = { position: [1, 9, 25], target: [-6, 1.5, 9], fov: 50 }),
        ($n.realiste = { position: [16, 15, 44], target: [-8, 4, 2], fov: 51 }),
        ($n.eaurive = { position: [-9, 4.3, 28], target: [1, 0.4, 14], fov: 60 }),
        Aa("realiste", !0),
        T.querySelector("[data-view]").addEventListener("change", (e) => Aa(e.target.value)),
        T.querySelector("[data-reset]").addEventListener("click", () => Aa(Wa)),
        T.querySelectorAll("[data-light]").forEach((e) =>
          e.addEventListener("click", () => Li(e.dataset.light === "soir")),
        ),
        Fo.addEventListener("change", () => {
          Po = !0;
        }),
        Fo.addEventListener("start", () => {
          Jn = null;
        }),
        window.ResizeObserver ? new ResizeObserver(Wr).observe(le) : window.addEventListener("resize", Wr),
        Wr(),
        window.IntersectionObserver &&
          new IntersectionObserver((e) => {
            ((rr = e[0].isIntersecting), rr && (Po = !0));
          }).observe(le),
        document.addEventListener("visibilitychange", () => {
          ((qa = Ua = performance.now()), document.hidden || (Po = !0));
        }),
        T.querySelector("[data-trees]").addEventListener("click", () => {
          ((_t.visible = !_t.visible),
            T.querySelector("[data-trees]").setAttribute("aria-pressed", String(_t.visible)),
            (xo.shadowMap.needsUpdate = !0),
            ho++,
            (Po = !0));
        }),
        T.querySelector("[data-motion]").addEventListener("click", () => {
          ((oa = !oa), T.querySelector("[data-motion]").setAttribute("aria-pressed", String(oa)), (Po = !0));
        }),
        T.querySelector("[data-motion]").setAttribute("aria-pressed", String(oa)));
      let xa = 0,
        Ua = performance.now();
      (await te.step("M\xE9t\xE9o et sauvegarde du jardin\u2026"),
        (Uo = MoulinWeather(a, {
          scene: qn,
          model: Xe,
          camera: ko,
          renderer: xo,
          hemi: Ir,
          sun: $o,
          fill: ar,
          surfaces: W,
          root: T,
          mobile: O,
          waterEffects: po,
          bounds: Bt,
          terrainHeight: Rt,
          snowCaps: rt,
          waterRegions: Re,
          islands: et,
          inside: ue,
          getWindState: () => ({
            value: (S == null ? void 0 : S.wind.value) ?? 0.2,
            direction: S == null ? void 0 : S.windDirection.value,
          }),
          wetAt: ae,
          markDirty: () => {
            ((Po = !0), ho++);
          },
        })),
        Uo.setQuality(Qn),
        (h = MoulinProps19(a, {
          model: Xe,
          ground: Nn,
          terrainHeight: Rt,
          wetAt: ae,
          inside: ue,
          surfaces: W,
          standard: H,
          rgb: xe,
          bounds: Bt,
          markDirty: () => {
            Po = !0;
          },
          invalidate: () => {
            var e;
            ((Po = !0),
              ho++,
              (xo.shadowMap.needsUpdate = !0),
              Uo == null || Uo.decorate(),
              z == null || z.refreshMaterials(),
              x == null || x.sync(),
              (e = c == null ? void 0 : c.sync) == null || e.call(c));
          },
        })),
        (p = MoulinVegetation20(a, {
          model: Xe,
          forest: Vn,
          props: h,
          terrainHeight: Rt,
          cameraSupportHeight: Nn,
          ground: Nn,
          bounds: Bt,
          inside: ue,
          wetAt: ae,
          edgeDistance: se,
          waterRegions: Re,
          channels: ee,
          channelSample: ge,
          foundationFootprints: w,
          footprintDistance: be,
          paths: Se,
          propertyTrails: Ie,
          trailSample: Ct,
          yard: nn,
          patio: gn,
          pointGarden: J,
          hillSteps: Sa,
          hillCorridorAt: jt,
          wallSupports: ja,
          surfaces: W,
          standard: H,
          rgb: xe,
          Batch: m,
          scope: "all",
        })),
        h.replace(
          p.defaultObjects.filter((e) => {
            var o;
            return !(
              yn.clearanceAt(e.x, e.z) &&
              ((o = h.catalog.find((r) => r.id === e.type)) == null ? void 0 : o.category) === "V\xE9g\xE9tation"
            );
          }),
        ));
      const na = ls.install(h, { ground: Nn, standard: H, rgb: xe });
      {
        const e = na.migrateDocument;
        na.migrateDocument = function (o) {
          const r = e(o);
          if (!r || r.worldVersion >= 23) return r;
          const s = (r.objects || []).map((Pe) => ({ ...Pe })),
            u = new Set(s.map((Pe) => Pe.id)),
            _ = s.filter((Pe) => Pe.type === "quad"),
            L = _.length === 1 ? _[0] : null;
          L &&
            Math.hypot(L.x - 4.5, L.z + 17.8) < 0.001 &&
            Math.abs((L.scale ?? 1) - 1) < 0.001 &&
            Math.abs(L.yOffset || 0) < 0.001 &&
            Math.abs((L.rotation ?? 0) + Math.PI / 2) < 0.001 &&
            (L.variant ?? 0) === 0 &&
            yn.entryQuad &&
            Object.assign(L, yn.entryQuad, { yOffset: 0 });
          function Ae(Pe) {
            return (r.paths || []).some((Te) =>
              (Te.points || []).some((it, dt) => {
                if (!dt) return !1;
                const Ue = Te.points[dt - 1],
                  wt = it[0] - Ue[0],
                  St = it[1] - Ue[1],
                  Nt = Math.max(0, Math.min(1, ((Pe.x - Ue[0]) * wt + (Pe.z - Ue[1]) * St) / (wt * wt + St * St || 1)));
                return Math.hypot(Pe.x - Ue[0] - Nt * wt, Pe.z - Ue[1] - Nt * St) < (Te.width || 1) * 0.5 + 0.7;
              }),
            );
          }
          for (const Pe of p.fountainObjects23 || [])
            u.has(Pe.id) ||
              Ae(Pe) ||
              s.some((Te) => Math.hypot(Te.x - Pe.x, Te.z - Pe.z) < 0.72) ||
              (s.push({ ...Pe }), u.add(Pe.id));
          return { ...r, objects: s, worldVersion: 29 };
        };
      }
      {
        const e = na.migrateDocument;
        na.migrateDocument = function (o) {
          const r = e(o);
          return !r || r.gardenVersion25 >= 1 ? r : { ...r, objects: Ii(r.objects || []), gardenVersion25: 1 };
        };
      }
      (h.replace(Ii([...h.exportRecords(), ...na.defaultObjects])), h.replace(Ni(h.exportRecords())));
      {
        const e = na.migrateDocument;
        na.migrateDocument = (o) => {
          const r = e(o);
          return !r || r.gardenDetails29 >= 1 ? r : { ...r, gardenDetails29: 1, objects: Ni(r.objects || []) };
        };
      }
      await te.step("Votre personnage\u2026");
      const qr = await MoulinLoadAvatar22(a),
        ji = [
          ...X.featuresV7.footbridges,
          {
            centre: M,
            angle: X.bridge.angleRadians,
            length: X.bridge.length,
            width: X.bridge.width,
            deckLevel: X.bridge.deckLevel,
          },
          {
            centre: He(X.upstreamFootbridge.centre),
            angle: X.upstreamFootbridge.angleRadians,
            length: 3.85,
            width: X.upstreamFootbridge.width,
            deckLevel: X.upstreamFootbridge.deckLevel,
          },
        ];
      ((k = MoulinPlayer22(a, {
        avatar22: qr,
        world22: yn,
        weather: () => Uo,
        getWeatherState: () =>
          (z == null ? void 0 : z.getWeatherState()) || { mode: Uo.mode, snow: Uo.uniforms.snow.value },
        bridgeSurfaces: yn.bridgeSurfaces,
        root: T,
        mount: le,
        model: Xe,
        scene: qn,
        camera: ko,
        controls: Fo,
        renderer: xo,
        terrainHeight: Rt,
        cameraSupportHeight: Nn,
        wetAt: ae,
        inside: ue,
        ponds: vt,
        islands: et,
        foundationFootprints: w,
        footprintDistance: be,
        bounds: Bt,
        bridges: ji,
        waterRegions: Re,
        channels: ee,
        channelSample: ge,
        hillSteps: Sa,
        wallSupports: ja,
        forest: Vn,
        props: h,
        parkedCars: N.cars,
        onCarChange: (e) => (v == null ? void 0 : v.setCar24(e)),
        onVehicleChange: (e) => (v ? v.setObject(e.id, e) : h.update(e.id, e)),
        audioEvents: (e, o) => (S == null ? void 0 : S.play(e, o)),
        markDirty: () => {
          Po = !0;
        },
        invalidate: () => {
          Po = !0;
        },
        requestMode: (e) => (v == null ? void 0 : v.setMode(e)),
      })),
        (x = MoulinContacts20(a, { model: Xe, ground: Nn, props: h, foundationFootprints: w })),
        (S = MoulinAmbience20(a, {
          root: T,
          mount: le,
          camera: ko,
          player: () => k,
          terrainHeight: Rt,
          wetAt: ae,
          waterRegions: Re,
          channels: ee,
          props: h,
          weather: Uo,
          markDirty: () => {
            Po = !0;
          },
        })),
        await te.step("Herbe et ambiance\u2026"),
        (C = MoulinGroundLife22(a, {
          weather: () => Uo,
          root: T,
          model: Xe,
          camera: ko,
          player: () => k,
          props: h,
          terrainHeight: Rt,
          ground: Nn,
          wetAt: ae,
          inside: ue,
          bounds: Bt,
          surfaces: W,
          terrainData: qt,
          renderCache: Ma,
          paths: Se,
          propertyTrails: yn.propertyTrails,
          trailSample: Ct,
          foundationFootprints: w,
          footprintDistance: be,
          yard: nn,
          patio: gn,
          pointGarden: J,
          hillCorridorAt: jt,
          hillSteps: Sa,
          clearanceAt: yn.clearanceAt,
          trailVisible: yn.trailVisible,
          getPaths: () => (v == null ? void 0 : v.getPaths()) || [],
          smokeOrigins: yn.smokeOrigins,
          grassAllowed: (e, o) => !ue([e, o], N.forecourt) && !ue([e, o], _r),
          wind: S.wind,
          windDirection: S.windDirection,
          markDirty: () => {
            Po = !0;
          },
        })),
        C.setQuality(Qn),
        (P = MoulinLife20(a, { model: Xe, props: h, wind: S.wind })),
        P.setQuality(Qn),
        typeof MoulinWind20 == "function" && (c = MoulinWind20(a, { model: Xe, forest: Vn, props: h })));
      let Ri = 0;
      (await te.step("Votre jardin sauvegard\xE9\u2026"),
        (je = MoulinShore29(a, {
          model: Xe,
          camera: ko,
          controls: Fo,
          waterRegions: Re,
          waterMeshes: io,
          terrainData: qt,
          terrainHeight: Rt,
          inside: ue,
          islands: et,
          atlasBounds: Q,
          markDirty: () => {
            Po = !0;
          },
          locked: (e, o) =>
            fe(e, o) ||
            w.some((r) => be(e, o, r) < 2) ||
            ue([e, o], gn) ||
            ue([e, o], nn) ||
            ee.some((r) => {
              const s = ge([e, o], r, r.maxWidth / 2 + 2.2);
              return s.distance < s.width / 2 + 2.2;
            }) ||
            yn.bridgeSurfaces.some(
              (r) =>
                r.centre &&
                Math.hypot(e - r.centre[0], o - r.centre[1]) < Math.max(r.length || 4, r.width || 4) * 0.65 + 2,
            ),
          rebuildRims: () => {
            Ga.length = Fa.length = La.length = Va.length = 0;
            for (const e of Re)
              for (let o = 0; o < e.poly.length; o++) $a(e.poly[o], e.poly[(o + 1) % e.poly.length], e.level);
            for (const e of ee)
              for (const o of Oo.channels[e.name] || []) {
                const r = o.outer;
                for (let s = 0; s < r.length; s++) {
                  const u = r[s],
                    _ = r[(s + 1) % r.length],
                    L = [(u[0] + _[0]) / 2, (u[1] + _[1]) / 2];
                  if (Re.some((Te) => ue(L, Te.poly) || se(L, Te.poly, !0, 0.6) < 0.6)) continue;
                  const Ae = ge(u, e),
                    Pe = ge(_, e);
                  Math.abs(Ae.height - Pe.height) < 0.1 && $a(u, _, Ae.height, e, Pe.height);
                }
              }
            for (const [e, o, r] of [
              [Ki, Ga, Fa],
              [Qi, La, Va],
            ]) {
              e.geometry.dispose();
              const s = new a.BufferGeometry();
              (s.setAttribute("position", new a.Float32BufferAttribute(o, 3)),
                s.setAttribute("color", new a.Float32BufferAttribute(r, 3)),
                s.computeVertexNormals(),
                s.computeBoundingSphere(),
                (e.geometry = s));
            }
          },
          refreshDepth: (e, o, r, s) => {
            for (let u = 0; u < ut.length; u++) {
              const _ = u * 4,
                L = ut.charCodeAt(u);
              At[_] = At[_ + 1] = At[_ + 2] = L;
            }
            for (const u of e) {
              const _ = o[u.index],
                L = Math.max(0, Math.floor(((u.x0 - Q[0]) / (Q[1] - Q[0])) * Oe)),
                Ae = Math.min(Oe - 1, Math.ceil(((u.x1 - Q[0]) / (Q[1] - Q[0])) * Oe)),
                Pe = Math.max(0, Math.floor(((u.z0 - Q[2]) / (Q[3] - Q[2])) * Oe)),
                Te = Math.min(Oe - 1, Math.ceil(((u.z1 - Q[2]) / (Q[3] - Q[2])) * Oe));
              for (let it = Pe; it <= Te; it++)
                for (let dt = L; dt <= Ae; dt++) {
                  const Ue = Q[0] + ((dt + 0.5) / Oe) * (Q[1] - Q[0]),
                    wt = Q[2] + ((it + 0.5) / Oe) * (Q[3] - Q[2]),
                    St = (it * Oe + dt) * 4;
                  let Nt = At[St];
                  (ue([Ue, wt], _.poly)
                    ? (Nt = Math.round(255 * Math.min(1, s(Ue, wt, _.poly).d / 7)))
                    : ue([Ue, wt], r[u.index]) && (Nt = 0),
                    (At[St] = At[St + 1] = At[St + 2] = Nt));
                }
            }
            Vt.needsUpdate = !0;
          },
        })),
        (v = MoulinEditor(a, {
          shore29: je,
          beforeModeChange: (e, o) => {
            o === "globe" && (Me == null || Me.exit(), (Un = null), ho++, (xo.shadowMap.needsUpdate = !0));
          },
          onModeChange: (e) => {
            (e === "globe" && Or().enter(), Ur());
          },
          catalogue21: na,
          propertyTrails: yn.propertyTrails,
          setPropertyTrailVisible: yn.setPropertyTrailVisible,
          setTerrainClearedRegions: (e) => C.setTerrainClearedRegions(e),
          root: T,
          mount: le,
          model: Xe,
          camera: ko,
          controls: Fo,
          renderer: xo,
          props: h,
          player: k,
          cancelTransition: () => {
            Jn = null;
          },
          forest: Vn,
          landscapeDetails: da,
          foundationFootprints: w,
          footprintDistance: be,
          foundationLimit: ne,
          protectedSite: fe,
          hydraulicBed: K,
          rearBed: E,
          rearWallSample: mt,
          terrainData: qt,
          terrainHeight: Rt,
          ground: ai,
          bounds: Bt,
          inside: ue,
          wetAt: ae,
          ponds: vt,
          islands: et,
          yard: nn,
          patio: gn,
          pointGarden: J,
          architecture: Mt,
          surfaces: W,
          standard: H,
          rgb: xe,
          Batch: m,
          ribbon: Tt,
          selectView: Aa,
          cameraSupportHeight: Nn,
          invalidate: () => {
            var e;
            ((Po = !0),
              ho++,
              (xo.shadowMap.needsUpdate = !0),
              Uo == null || Uo.decorate(),
              z == null || z.refreshMaterials(),
              x == null || x.sync(),
              (e = c == null ? void 0 : c.sync) == null || e.call(c));
          },
          terrainChanged: () => {
            (yn.enforceGround(),
              Uo == null || Uo.updateGround(),
              C == null || C.syncTerrain(),
              lt == null || lt.refreshBanks(),
              fs(),
              Ne == null || Ne.invalidateMap());
          },
          markDirty: () => {
            Po = !0;
          },
          getWaterMaterial: () => D.waterExport,
        })),
        (b = MoulinShell19({
          root: T,
          mount: le,
          renderer: xo,
          markDirty: () => {
            Po = !0;
          },
        })),
        (n = T.querySelector("[data-globe26-rotate]")) == null ||
          n.addEventListener("click", () => {
            (Or().setRotating(!Fo.autoRotate), Ur());
          }),
        (A = T.querySelector("[data-globe26-recenter]")) == null ||
          A.addEventListener("click", () => {
            (Or().recenter(), (Po = !0));
          }),
        (re = T.querySelector("[data-entry23]")) == null ||
          re.addEventListener("click", () => {
            (v.setMode("play"),
              k.goToEntrance()
                ? (b.setSettings(!1), b.announce("De retour \xE0 l\u2019entr\xE9e du domaine"))
                : b.announce("Le point de d\xE9part est occup\xE9. D\xE9place les objets proches dans Am\xE9nager."));
          }),
        (Ne = MoulinGameUI22({
          root: T,
          model: Xe,
          camera: ko,
          player: () => k,
          editor: () => v,
          bounds: Bt,
          waterRegions: Re,
          channels: ee,
          foundationFootprints: w,
          siteLayout: N,
          paths: Se,
          islands: et,
          patio: gn,
          yard: nn,
          pointGarden: J,
          bridges: yn.bridgeSurfaces,
          markDirty: () => {
            Po = !0;
          },
        })),
        v.setMode("play"),
        (V = MoulinInteractions25(a, { root: T, model: Xe, player: k, props: h, camera: ko, renderer: xo })),
        (ce = MoulinAdventure24(a, {
          root: T,
          model: Xe,
          player: k,
          editor: v,
          terrainHeight: Rt,
          wetAt: ae,
          announce: (e) => b.announce(e),
          markDirty: () => {
            ((Po = !0), (xo.shadowMap.needsUpdate = !0));
          },
        })),
        (lt = MoulinWildlife29(a, {
          model: Xe,
          standard: H,
          rgb: xe,
          mobile: O,
          waterRegions: Re,
          islands: et,
          inside: ue,
          wetAt: ae,
          terrainHeight: Rt,
          protectedSite: fe,
          player: k,
          weather: () => Uo,
          night: () => z,
          getMode: () => (v == null ? void 0 : v.mode),
        })),
        (z = MoulinNight22(a, {
          root: T,
          mount: le,
          scene: qn,
          model: Xe,
          camera: ko,
          renderer: xo,
          sun: $o,
          hemi: Ir,
          fill: ar,
          lamps: Ao,
          lampMats: pn,
          windows: De,
          waterDaylight: wo,
          waterEffects: po,
          forest: Vn,
          weather: () => Uo,
          player: () => k,
          getMode: () => (v == null ? void 0 : v.mode),
          getQuality: () => Qn,
          mobile: O,
          markDirty: () => {
            Po = !0;
          },
          invalidate: () => {
            ((Po = !0), ho++);
          },
          onModeChange: (e) => {
            ((us = e !== "day"), (Po = !0), ho++);
          },
        })),
        await te.step("Pr\xE9paration de la prairie\u2026"),
        await C.prepare27(() => {
          var e;
          return (e = te.yield) == null ? void 0 : e.call(te);
        }),
        Vi(),
        (R = te.finish) == null || R.call(te),
        xo.domElement.addEventListener("webglcontextlost", (e) => {
          var o;
          (e.preventDefault(),
            (o = te.fail) == null ||
              o.call(te, new Error("Le navigateur a interrompu le rendu 3D pour lib\xE9rer de la m\xE9moire.")));
        }),
        O &&
          ((T.querySelector("[data-fly-hint]").textContent =
            "Glisser pour regarder \xB7 Fl\xE8ches pour avancer \xB7 + / \u2212 pour monter ou descendre"),
          (T.querySelector("[data-orbit-note]").textContent =
            "Un doigt : tourner \xB7 Deux doigts : zoomer ou d\xE9placer")),
        (window.moulin3D = {
          build: 31,
          hostingBuild: "cloudflare-31",
          shore29: je,
          wildlife29: lt,
          details29: Ke,
          get globe26() {
            return Me;
          },
          interactions25: V,
          adventure24: ce,
          gameUI22: Ne,
          night22: z,
          syncShadowCamera: Oa,
          flushReflection: Eo,
          world22: yn,
          groundLife22: C,
          avatar22: qr,
          world21: yn,
          groundLife21: C,
          catalogue21: na,
          avatar21: qr,
          stage20: "all",
          vegetation20: p,
          ambience: S,
          contacts20: x,
          windSystem20: c,
          life20: P,
          waterFX20: tr,
          player: k,
          props: h,
          shell: b,
          walkBridges: ji,
          finish18: ss,
          hillGround17: Dt,
          hillCorridorAt: jt,
          wallSupports: ja,
          pathSurfaces: Ar,
          waterRegions: Re,
          channels: ee,
          channelSample: ge,
          wetAt: ae,
          protectedSite: fe,
          siteSupportHeight: Bi,
          hillSteps: Sa,
          siteLayout: N,
          foundationFootprints: w,
          footprintDistance: be,
          foundationLimit: ne,
          rearWallSample: mt,
          landscapeDetails: da,
          assetSources: W.sources,
          boot: te.state,
          mobile: O,
          weather: Uo,
          getRenderState: () => ({
            inViewport: rr,
            hidden: document.hidden,
            waterMotion: oa,
            lastFrame: qa,
            lastSimulation: Ua,
          }),
          renderStats: In,
          renderCache: Ma,
          reflectionState: Xo,
          setQuality: jr,
          editor: v,
          forest: Vn,
          get birds() {
            return wa;
          },
          terrainData: qt,
          scene: qn,
          model: Xe,
          camera: ko,
          controls: Fo,
          renderer: xo,
          presets: $n,
          selectView: Aa,
          setNight: Li,
          treeCount: Ya,
          grassTufts: ti,
          terrainHeight: Rt,
          cameraSupportHeight: Nn,
          enforceCameraSafety: Rr,
          waterMeshes: io,
          waterClock: ao,
          exportGLB: async () => (
            await globalThis.MoulinHost30.loadExporter(),
            new Promise((e, o) => {
              try {
                const r = new a.Scene();
                r.name = "Moulin_Saint_Christophe";
                const s = MoulinStaticExport(a, Xe, D.waterExport);
                (r.add(s),
                  s.traverse((u) => {
                    (u.isLight && (u.visible = !1),
                      u.name === "Boisements" && (u.visible = !0),
                      u.userData.isWater && ((u.material = D.waterExport), (u.onBeforeRender = () => {})));
                  }),
                  new a.GLTFExporter().parse(r, (u) => e(u), { binary: !0, onlyVisible: !0, truncateDrawRange: !0 }));
              } catch (r) {
                o(r);
              }
            })
          ),
        }),
        (moulinV32 = globalThis.MoulinV32.start(window.moulin3D, {
          markDirty: () => {
            Po = !0;
          },
          invalidate: () => {
            ((Po = !0), ho++, (xo.shadowMap.needsUpdate = !0));
          },
          refreshShadows: () => {
            ((xo.shadowMap.needsUpdate = !0), (Po = !0));
          },
          syncSun: () => Oa(),
          root: T,
          mount: le,
          mobile: O,
          sun: $o,
          hemi: Ir,
          fill: ar,
          getQuality: () => Qn,
          setQuality: jr,
          getMode: () => (v == null ? void 0 : v.mode),
          setMode: (e) => (v == null ? void 0 : v.setMode(e)),
          globe: () => Or(),
          refreshGlobeBar: () => Ur(),
          waterUniforms: po,
          waterDaylight: wo,
          materials: D,
          surfaces: W,
          boot: te,
          wind: S,
          ground: Nn,
          inside: ue,
          islands: et,
          terrainHeight: Rt,
          waterMeshes: io,
          waterClock: ao,
          animationsEnabled: () => oa,
        })));
    } catch (te) {
      ((he = globalThis.MoulinBoot) == null || he.fail(te), console.error(te));
    }
  })());
