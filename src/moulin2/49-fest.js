// La Fête du Moulin — « Dream Mill Fest » : les lieux où l'on se retrouve, en dehors des jeux, et
// les clins d'œil aux entrepreneurs et indie hackers (titres de livres, devises et expressions
// connues, en hommage : rien ici ne prétend que ces personnes soutiennent la fête).
//
//   La terrasse du moulin : on s'assoit dans le vrai salon de jardin (canapé, deux fauteuils) et à
//     la vraie table (quatre chaises, l'ordinateur posé dessus).
//   La pointe de la terrasse (par le petit pont du bief) : charrettes, table, et le bouton
//     « SHIP IT » qui tire un feu d'artifice au-dessus de l'étang, vu de tous.
//   Le camp des bûcherons (rive est du Grand étang) : feu de camp « Indie Hackers » (huit rondins où
//     s'asseoir), hamacs « The 4-Hour Workweek ».
//   Le bord du plateau : montgolfière « Up and to the right » où l'on monte à quatre.
//   Un peu partout : panneaux-citations ; dans le pré, la vache violette.
//
//   MF.fest.build({ world, places, presence, net, zone, put }) → { update(dt, t, camera) }
(function () {
  "use strict";
  const MF = (globalThis.MoulinFete = globalThis.MoulinFete || {});
  const TAU = Math.PI * 2;
  const BALLOON = { x: -95, z: -4, rise: 34, drift: 18, period: 72 }; // un vol toutes les 72 s : 18 s au sol, montée, palier, descente
  const BUTTON = { x: 10.8, z: 14.4 };
  const SKY = { x: 2, z: 27 }; // le feu d'artifice éclate au-dessus de la baie nord du Grand étang

  // Dans un hamac : quelques phrases de « The 4-Hour Workweek » (Tim Ferriss), une toutes les cinq
  // secondes ; chacune s'efface en poussière. De courtes citations, avec leur source.
  const QUOTES = [
    "Focus on being productive instead of busy.",
    "What we fear doing most is usually what we most need to do.",
    "Conditions are never perfect.",
    "“Someday” is a disease that will take your dreams to the grave with you.",
    "Being busy is a form of laziness: lazy thinking and indiscriminate action.",
    "Lack of time is actually lack of priorities.",
    "Less is not laziness.",
    "The timing is never right.",
    "Ask for forgiveness, not permission.",
    "Emphasize strengths, don't fix weaknesses.",
    "Things in excess become their opposite.",
    "Distress is bad, eustress is good.",
    "Slow down and remember this: most things make no difference.",
  ];
  const SOURCE = "Tim Ferriss, The 4-Hour Workweek";
  /** Bandeau de citations (canevas 2D par-dessus la vue) : apparition, lecture, puis poussière. */
  function dustQuotes(host) {
    if (typeof document === "undefined" || !host) return { show() {} };
    const W = 960, H = 230, cv = document.createElement("canvas"), c = cv.getContext("2d");
    cv.width = W;
    cv.height = H;
    // dans un cadre à part : les styles de la page étirent tout canevas posé directement dans la vue
    const box = document.createElement("div");
    box.className = "fete-dust";
    box.hidden = true;
    box.appendChild(cv);
    (host.querySelector(".fete-ui") || host).appendChild(box);
    let on = false, index = Math.floor(Math.random() * QUOTES.length), phase = "read", t = 0, parts = [], raf = 0, last = 0;
    function draw(alpha) {
      c.clearRect(0, 0, W, H);
      c.globalAlpha = alpha;
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.font = `400 40px ${MF.FONT}`;
      // coupe en lignes de 880 px au plus
      const words = QUOTES[index].split(" "), lines = [];
      let line = "";
      for (const w of words) {
        const test = line ? line + " " + w : w;
        if (c.measureText(test).width > 880 && line) {
          lines.push(line);
          line = w;
        } else line = test;
      }
      lines.push(line);
      const y0 = 92 - (lines.length - 1) * 24;
      c.lineJoin = "round";
      c.lineWidth = 8;
      c.strokeStyle = "rgba(43, 26, 16, 0.85)";
      c.fillStyle = "#fff6d8";
      lines.forEach((l, i) => {
        c.strokeText(l, W / 2, y0 + i * 48);
        c.fillText(l, W / 2, y0 + i * 48);
      });
      c.font = `400 22px ${MF.FONT}`;
      c.lineWidth = 5;
      c.strokeText("— " + SOURCE, W / 2, y0 + lines.length * 48 + 6);
      c.fillStyle = "#ffd54a";
      c.fillText("— " + SOURCE, W / 2, y0 + lines.length * 48 + 6);
      c.globalAlpha = 1;
    }
    function toDust() {
      const img = c.getImageData(0, 0, W, H).data;
      parts = [];
      for (let y = 0; y < H; y += 3)
        for (let x = 0; x < W; x += 3) {
          const k = (y * W + x) * 4;
          if (img[k + 3] < 110) continue;
          // la poussière part de gauche à droite, emportée vers le haut à droite
          parts.push({ x, y, vx: 50 + Math.random() * 150, vy: -25 - Math.random() * 70, life: 0.5 + Math.random() * 0.7, delay: (x / W) * 0.75 + Math.random() * 0.12, col: `rgb(${img[k]},${img[k + 1]},${img[k + 2]})`, wob: Math.random() * 6.28 });
        }
    }
    function frame(now) {
      if (!on) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      if (phase === "read") {
        draw(Math.min(1, t / 0.5));
        if (t >= 3.9) {
          draw(1);
          toDust();
          phase = "dust";
          t = 0;
        }
      } else {
        c.clearRect(0, 0, W, H);
        let alive = 0;
        for (const p of parts) {
          const k = t - p.delay;
          if (k < 0) {
            c.globalAlpha = 1;
            c.fillStyle = p.col;
            c.fillRect(p.x, p.y, 3, 3);
            alive++;
          } else if (k < p.life) {
            const u = k / p.life;
            c.globalAlpha = 1 - u;
            c.fillStyle = p.col;
            c.fillRect(p.x + p.vx * k + Math.sin(k * 9 + p.wob) * 5, p.y + p.vy * k, 2.6 * (1 - u * 0.5), 2.6 * (1 - u * 0.5));
            alive++;
          }
        }
        c.globalAlpha = 1;
        if (!alive || t > 1.1) {
          phase = "read";
          t = 0;
          index = (index + 1) % QUOTES.length;
        }
      }
      raf = requestAnimationFrame(frame);
    }
    return {
      show(v) {
        if (on === !!v) return;
        on = !!v;
        box.hidden = !on;
        if (on) {
          phase = "read";
          t = 0;
          last = performance.now();
          raf = requestAnimationFrame(frame);
        } else cancelAnimationFrame(raf);
      },
    };
  }

  /* ---- Feu d'artifice : des gerbes rondes, et des figures (dollar, pomme croquée, shiba, fusée…) */
  // Chaque figure est dessinée une fois sur un petit canevas ; ses pixels deviennent les étincelles.
  const SHAPES = {
    dollar(c) {
      c.fillStyle = "#3ddc6a";
      c.font = "900 46px Arial, sans-serif";
      c.fillText("$", 24, 26);
    },
    bitcoin(c) {
      c.fillStyle = "#ff9f1a";
      c.font = "900 42px Arial, sans-serif";
      c.fillText("B", 25, 26);
      c.fillRect(17, 3, 4, 42);
      c.fillRect(25, 3, 4, 42);
    },
    apple(c) {
      // une pomme croquée, sa feuille
      c.fillStyle = "#eef2f7";
      c.beginPath();
      c.arc(18, 28, 11, 0, 7);
      c.arc(30, 28, 11, 0, 7);
      c.arc(24, 33, 11, 0, 7);
      c.fill();
      c.globalCompositeOperation = "destination-out";
      c.beginPath();
      c.arc(41, 24, 7.5, 0, 7);
      c.fill();
      c.globalCompositeOperation = "source-over";
      c.beginPath();
      c.ellipse(27, 10, 6, 3, -0.8, 0, 7);
      c.fill();
    },
    doge(c) {
      // un shiba : oreilles, tête fauve, museau crème, yeux et truffe
      c.fillStyle = "#e0a650";
      for (const sx of [-1, 1]) {
        c.beginPath();
        c.moveTo(24 + sx * 6, 14);
        c.lineTo(24 + sx * 17, 4);
        c.lineTo(24 + sx * 16, 20);
        c.fill();
      }
      c.beginPath();
      c.arc(24, 27, 15, 0, 7);
      c.fill();
      c.fillStyle = "#fff3d6";
      c.beginPath();
      c.ellipse(24, 33, 9, 7.5, 0, 0, 7);
      c.fill();
      c.fillStyle = "#2b1a10";
      for (const [x, y, r] of [[17.5, 24, 2.2], [30.5, 24, 2.2], [24, 30, 2.6]]) {
        c.beginPath();
        c.arc(x, y, r, 0, 7);
        c.fill();
      }
      c.fillRect(20, 35, 8, 1.6);
    },
    rocket(c) {
      c.fillStyle = "#f4f6fb";
      c.beginPath();
      c.moveTo(24, 3);
      c.quadraticCurveTo(34, 14, 31, 33);
      c.lineTo(17, 33);
      c.quadraticCurveTo(14, 14, 24, 3);
      c.fill();
      c.fillStyle = "#e8402c";
      c.beginPath();
      c.moveTo(17, 24);
      c.lineTo(9, 37);
      c.lineTo(17, 34);
      c.moveTo(31, 24);
      c.lineTo(39, 37);
      c.lineTo(31, 34);
      c.fill();
      c.fillStyle = "#2f8fe8";
      c.beginPath();
      c.arc(24, 17, 4, 0, 7);
      c.fill();
      c.fillStyle = "#ffb02e";
      c.beginPath();
      c.moveTo(19, 34);
      c.lineTo(24, 46);
      c.lineTo(29, 34);
      c.fill();
    },
    heart(c) {
      c.fillStyle = "#ff4d6d";
      c.beginPath();
      c.arc(16, 18, 9.5, 0, 7);
      c.arc(32, 18, 9.5, 0, 7);
      c.fill();
      c.beginPath();
      c.moveTo(7.5, 22);
      c.lineTo(24, 43);
      c.lineTo(40.5, 22);
      c.fill();
    },
    star(c) {
      c.fillStyle = "#ffd54a";
      c.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 9 : 21, a = -Math.PI / 2 + (i * Math.PI) / 5;
        c.lineTo(24 + Math.cos(a) * r, 25 + Math.sin(a) * r);
      }
      c.fill();
    },
  };
  let shapeCache = null;
  /** Points de chaque figure : [dx, dy, r, g, b] (en « pixels », −24…24, y vers le haut). */
  function shapePoints() {
    if (shapeCache) return shapeCache;
    shapeCache = {};
    if (typeof document === "undefined") return shapeCache;
    const cv = document.createElement("canvas");
    cv.width = cv.height = 48;
    const c = cv.getContext("2d");
    for (const name in SHAPES) {
      c.clearRect(0, 0, 48, 48);
      c.textAlign = "center";
      c.textBaseline = "middle";
      SHAPES[name](c);
      const img = c.getImageData(0, 0, 48, 48).data, pts = [];
      for (let y = 0; y < 48; y++)
        for (let x = (y % 2) * 1; x < 48; x += 2) {
          const k = (y * 48 + x) * 4;
          if (img[k + 3] > 130) pts.push([x - 24, 24 - y, img[k] / 255, img[k + 1] / 255, img[k + 2] / 255]);
        }
      shapeCache[name] = pts;
    }
    return shapeCache;
  }

  /** Le feu d'artifice : un seul nuage de points (un appel de dessin), chaque étincelle a sa couleur, sa taille, son fondu. */
  function fireworks(parent, world, count = 1400) {
    const THREE = globalThis.THREE;
    const pos = new Float32Array(count * 3).fill(-999), tint = new Float32Array(count * 4), size = new Float32Array(count), parts = [];
    for (let i = 0; i < count; i++) parts.push({ life: 0, age: 0, vx: 0, vy: 0, vz: 0, tx: 0, ty: 0, tz: 0, shape: false, hold: 0 });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("tint", new THREE.BufferAttribute(tint, 4));
    geo.setAttribute("size", new THREE.BufferAttribute(size, 1));
    const material = new THREE.ShaderMaterial({
      uniforms: { scale: { value: 400 } },
      vertexShader: "attribute vec4 tint; attribute float size; varying vec4 vTint; uniform float scale; void main() { vTint = tint; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * scale / max(0.5, -mv.z); gl_Position = projectionMatrix * mv; }",
      fragmentShader: "varying vec4 vTint; void main() { float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; float core = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(mix(vTint.rgb, vec3(1.0), core * core * 0.55), vTint.a * smoothstep(0.5, 0.3, d)); }",
      transparent: true,
      depthWrite: false,
    });
    const points = new THREE.Points(geo, material);
    points.frustumCulled = false;
    points.name = "Feu_d_artifice";
    points.userData.live = true;
    points.visible = false;
    parent.add(points);
    const queue = []; // gerbes à venir : { at, x, y, z, color | shape }
    let next = 0, alive = 0, clock = 0;
    const cam = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), face = new THREE.Vector3();
    function spark(x, y, z, r, g, b, big) {
      const i = next++ % count, p = parts[i];
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
      tint[i * 4] = r;
      tint[i * 4 + 1] = g;
      tint[i * 4 + 2] = b;
      tint[i * 4 + 3] = 1;
      size[i] = big;
      p.age = 0;
      return p;
    }
    function burst(q) {
      const pts = q.shape && shapePoints()[q.shape];
      if (pts && pts.length) {
        // la figure se déploie face à celui qui regarde : chaque joueur la voit de face
        cam.copy(world.camera.position);
        face.set(cam.x - q.x, 0, cam.z - q.z).normalize();
        right.crossVectors(up, face).normalize();
        const k = 0.24; // 48 « pixels » → 11,5 m
        for (const [dx, dy, r, g, b] of pts) {
          const p = spark(q.x, q.y, q.z, r, g, b, 1.5);
          p.shape = true;
          p.tx = q.x + right.x * dx * k;
          p.ty = q.y + dy * k;
          p.tz = q.z + right.z * dx * k;
          p.life = 2.9 + Math.random() * 0.5;
          p.hold = 0.45 + Math.random() * 0.12;
        }
        alive = Math.max(alive, 3.6);
      } else {
        const c = MF.color(q.color || "#ffffff").clone().convertLinearToSRGB(); // le nuage écrit ses couleurs telles quelles
        for (let n = 0; n < 110; n++) {
          // direction au hasard sur la sphère, vitesse presque égale : une boule qui s'ouvre
          const u = Math.random() * 2 - 1, a = Math.random() * TAU, sr = Math.sqrt(1 - u * u), v = 7 + Math.random() * 3;
          const p = spark(q.x, q.y, q.z, c.r, c.g, c.b, 1.1);
          p.shape = false;
          p.vx = Math.cos(a) * sr * v;
          p.vy = u * v + 1.5;
          p.vz = Math.sin(a) * sr * v;
          p.life = 1.6 + Math.random() * 0.8;
        }
        alive = Math.max(alive, 2.6);
      }
      geo.attributes.tint.needsUpdate = true;
      geo.attributes.size.needsUpdate = true;
      points.visible = true;
      MF.sfx.play("choc");
    }
    return {
      /** Tire le bouquet « seed » (le même chez tous les joueurs) : gerbes rondes et deux figures. */
      launch(seed) {
        const rnd = MF.rng(seed | 0), colors = [MF.PAL.red, MF.PAL.yellow, MF.PAL.blue, MF.PAL.green, MF.PAL.pink, MF.PAL.orange, "#ffffff"];
        const names = Object.keys(SHAPES), first = Math.floor(rnd() * names.length), second = (first + 1 + Math.floor(rnd() * (names.length - 1))) % names.length;
        const el = world.renderer && world.renderer.domElement;
        material.uniforms.scale.value = el ? el.height * 0.55 : 400;
        let at = clock + 0.3;
        for (let i = 0; i < 4; i++, at += 0.38 + rnd() * 0.2) queue.push({ at, x: SKY.x + (rnd() - 0.5) * 24, y: 13 + rnd() * 9, z: SKY.z + (rnd() - 0.5) * 10, color: colors[Math.floor(rnd() * colors.length)] });
        queue.push({ at: at + 0.2, x: SKY.x - 5, y: 19, z: SKY.z, shape: names[first] });
        for (let i = 0; i < 3; i++) queue.push({ at: at + 1.3 + i * 0.45, x: SKY.x + (rnd() - 0.5) * 26, y: 12 + rnd() * 6, z: SKY.z + (rnd() - 0.5) * 10, color: colors[Math.floor(rnd() * colors.length)] });
        queue.push({ at: at + 3.1, x: SKY.x + 5, y: 20, z: SKY.z + 2, shape: names[second] });
        for (let i = 0; i < 4; i++) queue.push({ at: at + 4.4 + i * 0.3, x: SKY.x + (rnd() - 0.5) * 28, y: 13 + rnd() * 10, z: SKY.z + (rnd() - 0.5) * 12, color: colors[Math.floor(rnd() * colors.length)] });
        queue.sort((p, q) => p.at - q.at);
        MF.sfx.play("swing");
      },
      /** Durée du bouquet (s), pour la caméra de celui qui l'a tiré. */
      DURATION: 8.6,
      update(dt) {
        clock += dt;
        while (queue.length && queue[0].at <= clock) burst(queue.shift());
        if (alive <= 0) {
          if (points.visible && !queue.length) points.visible = false;
          return queue.length > 0;
        }
        alive -= dt;
        const drag = Math.exp(-1.6 * dt);
        for (let i = 0; i < count; i++) {
          const p = parts[i];
          if (p.life <= 0) continue;
          p.life -= dt;
          p.age += dt;
          if (p.life <= 0) {
            pos[i * 3 + 1] = -999;
            tint[i * 4 + 3] = 0;
            continue;
          }
          if (p.shape) {
            // vers sa place dans la figure (en 0,5 s), un léger scintillement, puis elle retombe en s'éteignant
            const k = 1 - Math.exp(-dt / (p.hold * 0.35));
            pos[i * 3] += (p.tx - pos[i * 3]) * k;
            pos[i * 3 + 1] += (p.ty - pos[i * 3 + 1]) * k;
            pos[i * 3 + 2] += (p.tz - pos[i * 3 + 2]) * k;
            if (p.life < 0.9) {
              p.ty -= dt * (1.5 + (0.9 - p.life) * 4);
              tint[i * 4 + 3] = p.life / 0.9;
            } else tint[i * 4 + 3] = 0.82 + 0.18 * Math.sin(p.age * 18 + i);
          } else {
            p.vx *= drag;
            p.vz *= drag;
            p.vy = p.vy * drag - 4.2 * dt;
            pos[i * 3] += p.vx * dt;
            pos[i * 3 + 1] += p.vy * dt;
            pos[i * 3 + 2] += p.vz * dt;
            tint[i * 4 + 3] = Math.min(1, p.life / 0.7);
          }
        }
        geo.attributes.position.needsUpdate = true;
        geo.attributes.tint.needsUpdate = true;
        return true;
      },
    };
  }

  function build(ctx) {
    const { world, places, presence, net, zone, put } = ctx, P = MF.props, H = (x, z) => world.heightAt(x, z);
    const riding = () => (MF.app && MF.app.seated && MF.app.seated()) || null;
    const taken = (s) => presence.list().some((r) => r.sitting && Math.hypot(r.tx - s.x, r.tz - s.z) < 0.34 && Math.abs(r.ty - s.y) < 1.5);
    const fixed = []; // places fixes qui ont une pose à elles (hamac, table) : les autres joueurs y sont dessinés pareil
    const reader = dustQuotes(world.dom);
    const seatPlace = (s, title, verb, icon, r = 1.0) => places.add({ id: s.id, x: s.x, z: s.z, r, icon, title, verb, when: () => !taken(s), run: () => MF.app && MF.app.sit(s) });
    /** Panneau sur deux piquets, lisible des deux côtés. */
    const board = (parent, text, x, z, heading, o = {}) => {
      const w = o.w || Math.max(2, text.length * 0.17), h = o.h || 0.42, y = o.y ?? H(x, z), top = o.top || 2.4;
      const g = MF.group({ name: "Panneau", x, y, z, ry: heading, parent });
      const sign = MF.sign(text, { w, h, px: 128, bg: o.bg || MF.PAL.cream, color: o.color || MF.PAL.ink, border: o.border || MF.PAL.ink, double: true });
      sign.position.y = top;
      g.add(sign);
      if (o.posts !== false) for (const sx of [-1, 1]) MF.cyl(0.035, 0.035, top, MF.PAL.woodDark, { x: sx * (w / 2 - 0.15), y: top / 2, parent: g, seg: 6 });
      return g;
    };

    /* ---- La terrasse du moulin : le vrai mobilier devient des places (relevé sur la page du moulin) */
    const terrace = zone("Terrasse_du_moulin", -2, 12, 100);
    const sofaExit = { x: -2.9, z: 14.9 };
    const lounge = [
      { id: "sofa-0", x: -3.9, z: 15.7, heading: 3.02, sit: 0.68, exit: sofaExit },
      { id: "sofa-1", x: -4.62, z: 15.61, heading: 3.02, sit: 0.68, exit: sofaExit },
      { id: "sofa-2", x: -5.33, z: 15.53, heading: 3.02, sit: 0.68, exit: sofaExit },
      { id: "armchair-0", x: -6.04, z: 14.43, heading: 1.45, sit: 0.68, exit: { x: -5.3, z: 13.4 } },
      { id: "armchair-1", x: -3.6, z: 13.78, heading: -0.4, sit: 0.68, exit: { x: -4.7, z: 13.2 } },
    ];
    // à la table : l'ordinateur est posé dessus (desk : hauteur du plateau au-dessus du sol)
    const table = [
      { id: "table-0", x: -1.94, z: 11.59, heading: 1.33, exit: { x: -2.95, z: 11.35 } },
      { id: "table-1", x: -1.63, z: 10.31, heading: 1.33, exit: { x: -2.65, z: 10.05 } },
      { id: "table-2", x: -0.27, z: 12.0, heading: -1.81, exit: { x: -0.3, z: 13.1 } },
      { id: "table-3", x: 0.04, z: 10.73, heading: -1.81, exit: { x: 0.75, z: 9.6 } },
    ];
    for (const s of lounge) {
      s.y = H(s.x, s.z);
      // vu de face, depuis le milieu de la terrasse : le salon, et le Grand étang derrière
      s.cam = { x: -4.7, y: s.y + 2.15, z: 11.3 };
      s.look = { x: -4.7, y: s.y + 0.75, z: 15.4 };
      seatPlace(s, "Deep Work Lounge", s.id.startsWith("sofa") ? "Sink into the sofa" : "Take the armchair", "🛋️", 0.85);
      fixed.push(s);
    }
    for (const s of table) {
      s.y = H(s.x, s.z);
      s.sit = 0.6;
      s.desk = 0.79;
      s.back = 3.0;
      seatPlace(s, "Ramen Profitable Table", "Take a seat", "🍜", 0.8);
      fixed.push(s);
    }
    // deux petits chevalets posés sur les tables (hauteurs relevées : table basse 1,55 m, table 1,97 m)
    board(terrace, "DEEP WORK LOUNGE", -4.5, 14.73, 3.02, { w: 0.9, h: 0.2, y: 1.55, top: 0.13, posts: false, bg: "#ff7f6b", color: "#ffffff", border: "#ffffff" });
    board(terrace, "RAMEN PROFITABLE · TABLE FOR 4", -0.95, 11.15, 1.33, { w: 1.1, h: 0.2, y: 1.97, top: 0.13, posts: false, bg: MF.PAL.yellow });

    /* ---- Le moulin en fête : enseigne dans le pignon sud, fanions sous le toit, ampoules, bâche du
       sponsor principal entre les deux étages. Le mur (relevé par rayons sur la page du moulin) va de
       (−6, 6,0) à (2,6, 8,0), son milieu est en (−1,7, 7,0) et le faîte à 11,2 m ; rien n'est changé à
       la maison : tout est accroché devant. */
    {
      const nx = -0.226, nz = 0.974, MID = 0.579; // normale du mur (vers la terrasse), milieu du pignon
      const wall = (t, out, y) => ({ x: -5.7 + 6.9 * t + nx * out, y, z: 6.1 + 1.57 * t + nz * out });
      const hang = (mesh, t, out, y) => {
        const c = wall(t, out, y);
        mesh.position.set(c.x, c.y, c.z);
        mesh.rotation.y = Math.atan2(nx, nz);
        terrace.add(mesh);
      };
      hang(MF.sign("DREAM MILL FEST", { w: 4.2, h: 0.8, bg: MF.PAL.red, color: "#ffffff", border: MF.PAL.yellow }), MID, 0.2, 8.7);
      hang(MF.sponsors.board("fest-moulin", 4.6, 0.85, { kicker: "Mill banner · main sponsor" }), MID, 0.16, 4.3);
      terrace.add(MF.bunting(wall(-0.02, 0.45, 7.5), wall(1.18, 0.45, 7.5), { sag: 0.4 }));
      terrace.add(P.lights(wall(0, 0.32, 6.25), wall(1.16, 0.32, 6.25), { sag: 0.3 }));
      // deux guirlandes par-dessus la terrasse : vers le lampadaire (qui existe) et vers un mât de fête
      const mast = { x: 0.6, z: 16.2 };
      put(terrace, MF.pole(4.7), mast.x, mast.z);
      terrace.add(MF.bunting(wall(0.0, 0.45, 7.45), { x: -7.7, y: 5.6, z: 15.3 }, { sag: 1.1 }));
      terrace.add(MF.bunting(wall(1.16, 0.45, 7.45), { x: mast.x, y: H(mast.x, mast.z) + 4.6, z: mast.z }, { sag: 1.1 }));
    }

    /* ---- La pointe de la terrasse : on y passe par le petit pont du bief */
    const point = zone("Pointe_de_la_terrasse", 9, 11, 110);
    put(point, P.cart("hotdog"), 12.8, 7.6, -0.5);
    put(point, P.cart("lemonade"), 13.6, 12.4, 2.4);
    put(point, P.picnic(), 7.6, 7.4, 0.2);
    board(point, "BUY ME A COFFEE", 14.4, 13.4, 2.4, { w: 2.2, bg: "#ffdd00", top: 2.5 });
    board(point, "STAY HUNGRY. STAY FOOLISH.", 13.4, 10.4, Math.PI / 2, { w: 3.4, top: 2.7 });
    // le bouton « SHIP IT » : un socle, un gros bouton rouge ; on appuie, le bouquet part
    const by = H(BUTTON.x, BUTTON.z);
    const stand = MF.group({ name: "Bouton_ship_it", x: BUTTON.x, y: by, z: BUTTON.z, parent: point });
    MF.cyl(0.26, 0.32, 0.9, "#2c3e50", { y: 0.45, parent: stand, seg: 12, cast: true });
    MF.cyl(0.34, 0.34, 0.06, MF.PAL.yellow, { y: 0.93, parent: stand, seg: 16 });
    const knob = MF.cyl(0.24, 0.26, 0.12, MF.mat(MF.PAL.red, { unique: true }), { y: 1.02, parent: stand, seg: 16 });
    knob.userData.live = true;
    board(point, "SHIP IT · LAUNCH DAY FIREWORKS", BUTTON.x + 1.3, BUTTON.z - 0.4, 0.5, { w: 3.2, y: by, bg: MF.PAL.red, color: "#ffffff", border: MF.PAL.yellow, top: 2.3 });
    board(point, "IF YOU'RE NOT EMBARRASSED BY V1, YOU SHIPPED TOO LATE", BUTTON.x + 1.3, BUTTON.z - 0.4, 0.5, { w: 3.2, y: by, h: 0.24, top: 1.9, posts: false });
    const show = fireworks(ctx.root || point.parent, world);
    let pressed = 0, cool = 0, quiet = 0, watching = 0; // quiet : pas deux bouquets à moins de 9 s (même venus d'un autre joueur)
    const fire = (seed) => {
      if (quiet > 0) return false;
      quiet = show.DURATION + 0.6;
      pressed = 0.25;
      show.launch(seed);
      world.invalidate();
      return true;
    };
    if (net)
      net.on("ship", (d, peer) => {
        if (!Array.isArray(d) || !Number.isFinite(d[0]) || !fire(d[0])) return;
        if (ctx.hud && ctx.hud.toast) ctx.hud.toast("🚀 " + ((peer && peer.name) || "Someone") + " shipped it! Fireworks above the lake");
      });
    // Celui qui appuie regarde le ciel : debout au bouton, caméra levée vers la baie, le temps du bouquet.
    const showSeat = { id: "ship-view", show: true, stand: true, laptop: false, x: BUTTON.x, y: by, z: BUTTON.z - 0.75, heading: 0.5, cam: { x: BUTTON.x + 0.9, y: by + 3.7, z: BUTTON.z - 2.4, sway: 0 }, look: { x: SKY.x, y: 17, z: SKY.z }, exit: { x: BUTTON.x, z: BUTTON.z - 0.9 } };
    places.add({
      id: "ship-it",
      x: BUTTON.x,
      z: BUTTON.z,
      r: 1.5,
      icon: "🚀",
      title: "Ship it",
      verb: "Push the button",
      when: () => cool <= 0 && quiet <= 0,
      run() {
        const seed = Math.floor(Math.random() * 1e9);
        cool = show.DURATION + 1;
        if (!fire(seed)) return;
        if (net) net.send("ship", [seed]);
        if (MF.app && MF.app.sit) {
          MF.app.sit(showSeat);
          watching = show.DURATION;
        }
      },
    });

    /* ---- Le camp des bûcherons : enseigne, feu de camp, hamacs (au sud des trois jeux d'arbres) */
    const camp = zone("Camp_des_bucherons", 30, 34, 120);
    board(camp, "THE LUMBER CAMP", 28.6, 19.6, 0, { w: 3.2, h: 0.55, bg: "#b5651d", color: "#ffffff", border: MF.PAL.yellow, top: 2.9 });
    board(camp, "IT DOESN'T HAVE TO BE CRAZY AT WORK", 26.4, 32.4, Math.PI / 2, { w: 3.8, top: 0.7, h: 0.34 });
    const fx = 28.4, fz = 43.0, fy = H(fx, fz);
    const pit = MF.group({ name: "Feu_de_camp", x: fx, y: fy, z: fz, parent: camp });
    for (let i = 0; i < 9; i++) MF.sphere(0.16, "#8f979b", { x: Math.cos((i / 9) * TAU) * 0.55, y: 0.08, z: Math.sin((i / 9) * TAU) * 0.55, parent: pit, seg: 6 });
    for (let i = 0; i < 3; i++) MF.cyl(0.07, 0.07, 0.9, "#6b4a2e", { y: 0.16, ry: i * 1.05, rz: Math.PI / 2 - 0.25, parent: pit, seg: 6 });
    const flames = MF.group({ parent: pit });
    flames.userData.live = true;
    const glow = MF.mat("#ffb02e", { emissive: "#ff7a1a", emissiveIntensity: 1 });
    const tongues = [0.5, 0.36, 0.3].map((h, i) => MF.cone(0.2 - i * 0.04, h, glow, { x: (i - 1) * 0.12, y: 0.2 + h / 2, z: (i % 2) * 0.1, parent: flames, seg: 6 }));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU, x = fx + Math.sin(a) * 2.0, z = fz + Math.cos(a) * 2.0, y = H(x, z);
      MF.cyl(0.3, 0.3, 0.44, i % 2 ? "#9a6a3c" : "#8a5a33", { x, y: y + 0.22, z, parent: camp, seg: 10, cast: true });
      MF.cyl(0.24, 0.24, 0.02, "#e6c998", { x, y: y + 0.45, z, parent: camp, seg: 10 });
      seatPlace({ id: "fire-" + i, x, y, z, heading: a + Math.PI }, "Indie Hackers Campfire", "Pull up a log", "🔥", 0.9);
    }
    board(camp, "INDIE HACKERS CAMPFIRE · BUILD IN PUBLIC", 28.4, 46.2, 0, { w: 4.2, bg: "#2c3e50", color: "#ffffff", border: "#ffffff", top: 2.2 });
    // hamacs à l'ombre des arbres : deux piquets, une toile ; on s'y allonge avec son ordinateur
    const cloth = ["#e84393", "#0984e3", "#00b894"];
    [[33.8, 44.4, 0.25], [35.6, 46.4, -0.3], [36.4, 43.4, 1.2]].forEach(([x, z, h], i) => {
      const y = H(x, z), g = MF.group({ name: "Hamac", x, y, z, ry: h, parent: camp });
      for (const s of [-1, 1]) MF.cyl(0.05, 0.06, 1.3, MF.PAL.woodDark, { z: s * 1.4, y: 0.65, rx: s * 0.2, parent: g, seg: 6, cast: true });
      for (let k = -2; k <= 2; k++) MF.box(0.9, 0.04, 0.54, cloth[i], { y: 0.62 - (1 - Math.abs(k) / 2) * 0.2, z: k * 0.48, rx: -Math.sign(k) * 0.2, parent: g });
      // allongé pour de bon (lying : la pose debout, renversée sur le dos), sans ordinateur : on lit
      const seat = { id: "hammock-" + i, hammock: true, x, y, z, heading: h, sit: 0.5, tilt: -1.42, lying: true, laptop: false, back: 2.5, up: 1.9, exit: { x: x + Math.cos(h) * 1.1, z: z - Math.sin(h) * 1.1 } };
      seatPlace(seat, "The 4-Hour Workweek", "Lie in the hammock", "🌴", 1.1);
      fixed.push(seat);
    });
    board(camp, "THE 4-HOUR WORKWEEK · HAMMOCKS", 32.4, 46.4, Math.PI / 2, { w: 3.4, bg: MF.PAL.yellow, top: 2.0 });

    /* ---- Panneaux-citations : l'entrée, l'allée des stands (côté ouest, face aux baraques), la colline */
    const quotes = zone("Citations_entree", 2, -66, 95);
    board(quotes, "IT'S ALWAYS DAY 1", -3.6, -84.6, 0.3, { w: 2.2, top: 0.75, h: 0.36, bg: MF.PAL.yellow });
    board(quotes, "THE LONG, SLOW SaaS RAMP OF DEATH · KEEP CLIMBING", -8.4, -78.3, 0, { w: 4.6, top: 0.75, h: 0.34 });
    for (const [z, text, bg] of [
      [-70.6, "ZERO TO ONE · RING THE BELL", MF.PAL.cream],
      [-64.6, "WHACK THE BUGS BEFORE THEY SHIP", "#d8f5d0"],
      [-58.6, "DO THINGS THAT DON'T SCALE", MF.PAL.cream],
      [-52.8, "SMALL BETS · MANY RINGS", "#ffe3ec"],
    ])
      board(quotes, text, -3.7, z, Math.PI / 2, { w: 3.0, top: 1.25, h: 0.34, bg });
    const hillQuotes = zone("Citations_colline", -52, -70, 110);
    board(hillQuotes, "MOVE FAST AND BREAK THINGS", -33.2, -82.9, 0, { w: 2.9, top: 0.75, h: 0.34 });
    board(hillQuotes, "MAKE SOMETHING PEOPLE WANT", -56.4, -79.4, Math.PI / 2, { w: 2.9, top: 0.75, h: 0.34, bg: "#fff0b8" });
    board(hillQuotes, "SHIP FAST RACEWAY", -66.6, -43.4, 0.9, { w: 3.0, h: 0.5, bg: MF.PAL.red, color: "#ffffff", border: MF.PAL.yellow, top: 3.0 });

    /* ---- Le pré : la vache violette (« Purple Cow » : être remarquable), près des tables */
    const meadow = zone("Vache_violette", 41, -9, 100);
    {
      const cow = MF.group({ name: "Vache_violette", x: 40.8, y: H(40.8, -9.4), z: -9.4, ry: 0.9, parent: meadow });
      const purple = "#8e44ad", pale = "#d7b5ea";
      MF.box(0.8, 0.75, 1.6, purple, { y: 1.05, parent: cow, cast: true });
      MF.box(0.5, 0.5, 0.6, purple, { y: 1.35, z: 1.0, parent: cow, cast: true });
      MF.box(0.36, 0.26, 0.24, pale, { y: 1.22, z: 1.36, parent: cow });
      for (const sx of [-1, 1]) {
        MF.cone(0.06, 0.24, "#ffffff", { x: sx * 0.2, y: 1.72, z: 0.95, rz: -sx * 0.5, parent: cow, seg: 6 });
        MF.box(0.2, 0.1, 0.05, purple, { x: sx * 0.36, y: 1.5, z: 0.95, parent: cow });
        for (const sz of [-0.55, 0.55]) MF.box(0.2, 0.7, 0.2, purple, { x: sx * 0.26, y: 0.35, z: sz, parent: cow });
      }
      MF.box(0.5, 0.3, 0.5, pale, { y: 0.92, z: -0.1, parent: cow });
      MF.box(0.3, 0.16, 0.36, "#ff9bc4", { y: 0.62, z: -0.35, parent: cow });
      MF.box(0.06, 0.5, 0.06, purple, { y: 1.0, z: -0.84, rx: 0.25, parent: cow });
      board(meadow, "THE PURPLE COW · BE REMARKABLE", 39.4, -10.6, 0.9, { w: 3.0, top: 0.7, h: 0.32, bg: pale });
    }

    /* ---- Le bord du plateau : poteau indicateur, montgolfière face à la vallée */
    const fields = zone("Bord_du_plateau", -98, -8, 170);
    put(
      fields,
      P.signpost([
        { text: "MINI-GOLF", color: MF.PAL.green, dir: -1.8 },
        { text: "THE IDEA MAZE", color: MF.PAL.purple, dir: -1.05 },
        { text: "BALLOON · UP AND TO THE RIGHT", color: MF.PAL.orange, dir: -0.55 },
        { text: "SHIP FAST RACEWAY · TIM FERRISS WHEEL", color: MF.PAL.red, dir: 2.6 },
      ]),
      -91.6,
      -10.4,
    );
    // la montgolfière : enveloppe rayée, nacelle d'osier, quatre places ; elle monte… et vers la droite
    const B = BALLOON, gy = H(B.x, B.z);
    MF.cyl(2.6, 2.6, 0.08, "#f3e3c2", { x: B.x, y: gy + 0.04, z: B.z, parent: fields, seg: 20 });
    board(fields, "UP AND TO THE RIGHT · BALLOON RIDES", B.x - 3.6, B.z + 3.4, 0.9, { w: 4.2, bg: MF.PAL.orange, color: "#ffffff", border: "#ffffff", top: 2.5 });
    board(fields, "SCREW IT, LET'S DO IT", B.x - 2.4, B.z - 3.0, -0.7, { w: 2.4, top: 0.7, h: 0.32 });
    const balloon = MF.group({ name: "Montgolfiere", parent: fields });
    balloon.userData.live = true;
    const shell = MF.group({ parent: balloon });
    MF.sphere(4.4, MF.PAL.red, { y: 8.6, parent: shell, seg: 18, cast: true }).scale.set(1, 1.12, 1);
    for (const [y, r, c] of [[10.6, 3.75, MF.PAL.yellow], [8.6, 4.42, "#ffffff"], [6.6, 3.75, MF.PAL.yellow]]) MF.torus(r, 0.36, c, { y, rx: Math.PI / 2, parent: shell, seg: 24, tubeSeg: 6 });
    MF.cone(1.9, 2.2, MF.PAL.red, { y: 3.9, rx: Math.PI, parent: shell, seg: 14 });
    // nacelle d'osier creuse : un plancher, quatre parois à hauteur de taille, un rebord
    MF.box(1.9, 0.08, 1.9, "#8a5a33", { y: 0.34, parent: shell, cast: true });
    for (const [bx, bz, bw, bd] of [[0, -0.92, 1.9, 0.07], [0, 0.92, 1.9, 0.07], [-0.92, 0, 0.07, 1.9], [0.92, 0, 0.07, 1.9]]) {
      MF.box(bw, 0.86, bd, "#b98350", { x: bx, y: 0.79, z: bz, parent: shell, cast: true });
      MF.box(bw + 0.06, 0.07, bd + 0.06, "#8a5a33", { x: bx, y: 1.24, z: bz, parent: shell });
    }
    // le brûleur, sous la gorge de l'enveloppe
    MF.cyl(0.16, 0.2, 0.3, MF.PAL.steel, { y: 2.55, parent: shell, seg: 8 });
    MF.cone(0.14, 0.5, MF.mat("#ffb02e", { emissive: "#ff7a1a", emissiveIntensity: 1 }), { y: 2.95, parent: shell, seg: 6 });
    for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) MF.cyl(0.02, 0.02, 2.2, "#5d4630", { x: sx * 0.9, y: 2.3, z: sz * 0.9, rz: sx * 0.12, rx: -sz * 0.12, parent: shell, seg: 4 });
    MF.freeze(shell);
    const seats = [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]].map(([dx, dz], i) => ({ id: "balloon-" + i, dx, dz, x: B.x + dx, y: gy + 0.38, z: B.z + dz, heading: Math.PI / 2, moving: true, ride: "balloon", laptop: false, stand: true, back: 3.4, up: 3.1, look: { x: 0, y: 0, z: 0 }, exit: { x: B.x - 3.2, z: B.z } }));
    let lift = 0, back = 0; // hauteur du vol (0…1) ; secondes avant le retour au sol
    places.add({
      id: "balloon",
      x: B.x - 2.6,
      z: B.z,
      r: 3,
      icon: "🎈",
      // en vol : l'invite dit dans combien de temps la nacelle revient (par pas de 5 s)
      get title() {
        return lift < 0.04 ? "Up and to the Right" : "Up and to the Right · back in " + Math.ceil(back / 5) * 5 + " s";
      },
      get verb() {
        return lift < 0.04 ? "Board the balloon" : "Wait for the balloon";
      },
      when: () => seats.some((s) => !taken(s)),
      run() {
        const s = lift < 0.04 && seats.find((q) => !taken(q));
        if (s && MF.app) MF.app.sit(s);
        else MF.sfx.play("bip");
      },
    });
    function pose(time) {
      // au sol (on embarque), montée, palier, descente : la même heure pour tous (celle de l'horloge)
      const p = (time % B.period) / B.period;
      lift = p < 0.25 ? 0 : p < 0.55 ? MF.smooth(0.25, 0.55, p) : p < 0.68 ? 1 : p < 0.97 ? 1 - MF.smooth(0.68, 0.97, p) : 0;
      back = p >= 0.25 && p < 0.97 ? (0.97 - p) * B.period : 0;
      const x = B.x + lift * B.drift, y = gy + 0.1 + lift * B.rise, z = B.z + Math.sin(time * 0.3) * 0.4 * lift;
      balloon.position.set(x, y, z);
      balloon.rotation.y = Math.sin(time * 0.12) * 0.3 * lift;
      for (const s of seats) {
        s.x = x + s.dx;
        s.y = y + 0.38; // debout sur le plancher de la nacelle
        s.z = z + s.dz;
        s.look.x = x + 60;
        s.look.y = y - 14 * lift;
        s.look.z = z + 30;
      }
    }
    const clock = () => Date.now() / 1000;
    pose(clock());
    // Un autre joueur dans la nacelle est dessiné à sa place telle qu'on la voit d'ici (comme pour les
    // manèges) ; dans un hamac ou à la table, il prend la pose de la place.
    const before = presence.snap;
    presence.snap = (r) => {
      let best = null, bd = 3.5;
      for (const s of seats) {
        const d = Math.hypot(r.tx - s.x, r.ty - s.y, r.tz - s.z);
        if (d < bd) ((best = s), (bd = d));
      }
      if (!best) best = fixed.find((s) => Math.hypot(r.tx - s.x, r.tz - s.z) < 0.34) || null;
      return best || (before ? before(r) : null);
    };

    MF.fest.fixed = fixed;
    return {
      balloon: B,
      seats,
      fixed,
      update(dt, time) {
        let dirty = false;
        if (cool > 0) cool -= dt;
        if (quiet > 0) quiet -= dt;
        if (watching > 0) {
          watching -= dt;
          // fin du bouquet : on reprend la promenade (si l'on ne s'est pas déjà levé)
          if (watching <= 0 && riding() === showSeat && MF.app.stand) MF.app.stand();
        }
        if (pressed > 0) {
          pressed -= dt;
          knob.position.y = pressed > 0 ? 0.97 : 1.02;
          dirty = true;
        }
        if (show.update(dt)) dirty = true;
        if (camp.visible) {
          tongues.forEach((m, i) => m.scale.set(1, 0.75 + Math.abs(Math.sin(time * (7 + i * 2.3) + i)) * 0.6, 1));
          dirty = true;
        }
        const seat = riding();
        reader.show(!!(seat && seat.hammock));
        if (fields.visible || (seat && seat.ride === "balloon")) {
          pose(clock());
          dirty = true;
        }
        return dirty;
      },
    };
  }

  MF.fest = { build, BALLOON, BUTTON, fixed: null };
})();
