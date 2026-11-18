// La Fête du Moulin — la carte du parc, façon brochure de parc d'attractions.
//
// Un plan illustré du domaine (relief, étangs, îles, rivière, arbres, le moulin), les allées de la
// fête, les zones nommées, une pastille par jeu et par manège, et tous les joueurs présents, en
// direct. En petit dans un coin (les alentours) ; en grand d'un clic ou avec la touche M : on
// clique alors une pastille pour s'y rendre.
//
//   const map = MF.ParkMap.create({ world, hud, entries, presence, net, go(x, z, heading), play(id) })
//   map.update(dt)   map.open()   map.close()   map.poi(icon, title, x, z)   (lieux ajoutés par le site)
(function () {
  "use strict";
  const MF = (globalThis.MoulinFete = globalThis.MoulinFete || {});
  const X0 = -178, X1 = 178, Z0 = -92, Z1 = 146, S = 4; // emprise (m) et pixels par mètre du plan
  const W = (X1 - X0) * S, H = (Z1 - Z0) * S, GAP = 46; // GAP : écart minimal entre deux pastilles (px du plan)
  // Zones (rubans) et allées de la fête (pointillés) : tracés à la main sur le plan du domaine.
  const ZONES = [
    ["MAIN GATE", 32, -86], ["THE MIDWAY", 36, -64], ["HILLTOP", -50, -52], ["THE PLATEAU", -132, 48], ["THE MILL", -24, -14], ["LUMBER CAMP", 64, 42],
    ["THE GREEN", 64, 16], ["EAST MEADOW", 140, 14], ["FOUNDERS' DECK", -66, 30], ["SOUTH SHORE", -52, 137], ["GRAND ÉTANG", -24, 64],
  ];
  const PATHS = [
    [[2, -88], [1, -72], [0, -57], [-2.3, -43], [-3.4, -34], [-1.2, -27], [-0.5, -18]], // l'allée du moulin
    [[-3.4, -80.6], [-26, -80.6], [-45, -76], [-62, -60], [-70, -46], [-88, -28], [-96, -10], [-118, -12], [-140, 12], [-160, 30]], // la colline, le plateau
    [[4, -22], [20, -16], [42, -9], [60, -8], [88, -4], [110, -4], [134, -8], [160, -5]], // le pré, jusqu'au pré de l'est
    [[-2, -8], [-6, 6], [-4, 12], [3.4, 9.5], [10, 11]], // la terrasse et sa pointe
    [[14, 2], [22, 12], [28, 24], [29, 40], [20, 52], [10, 70], [4, 92], [-14, 108], [-33, 118], [-50, 119.5], [-62, 124.6], [-72, 127]], // la rive est, jusqu'à la rive sud
    [[-8, 12], [-18, 18], [-31, 22]], // le ponton des fondateurs
  ];
  // Cours d'eau (relevés sur la page du moulin) : [largeur, [x, z]…] ; le bief fait le tour par le nord.
  const STREAMS = [
    [1.6, [170.8, -22.5], [168.2, -30.5], [166.7, -38.7], [164.5, -45], [159.3, -53.2], [154.4, -60], [148, -65.8], [139.9, -69.3], [131.5, -70.7], [121.6, -71.1], [112.2, -71.8], [102.5, -73.6], [92.6, -73.6], [83.6, -73.4], [74, -72.5], [66, -70.6], [58.7, -69.4], [51.2, -66.5], [45, -63], [37.7, -58.9], [33.6, -52.8], [29.5, -46], [25, -39.2], [21.5, -31.8], [18, -25.1], [10.5, -19], [10, -14], [7.8, -8], [6, -2], [4.6, 3.3], [3.9, 5.7], [3.3, 8.2], [3.7, 11.8], [3.3, 16.5], [3, 19.4]],
    [2.1, [178, -26], [170.8, -22.5], [162.6, -18], [156.6, -15.5], [146.3, -15.2], [135, -15.6], [127.7, -17.7], [121.2, -21.2], [113.5, -25.3], [108.4, -27.8], [103.1, -28.4], [94.1, -27.8], [89, -22]],
    [1.4, [41, -29], [37, -28], [34, -25.5], [30.5, -24], [28.8, -15.2]],
    [1.7, [25.2, 1.3], [23.4, 4.6], [20.5, 8], [18, 12.3], [17, 16], [14, 21], [12, 26]],
    [3, [-92.2, 98.4], [-97.5, 102.1], [-102.8, 105.4], [-107.2, 109.6], [-108.5, 113.9], [-109.4, 116.4]],
    [2.3, [-109.4, 116.4], [-115, 121.2], [-120.7, 125], [-126.4, 127.7], [-130.1, 133.9], [-138.8, 138.8], [-143.1, 143.6], [-153.6, 148.2], [-159.3, 155.8], [-168.8, 160.4], [-174.7, 167.9], [-183.3, 174.2]],
  ];
  // Toits : [cx, cz, angle, u0, u1, v0, v1, couleur] (le moulin, sa véranda, la dépendance)
  const ROOFS = [
    [-19.44, 6.21, 1.531, -3.35, 3.13, -11.65, 9.35, "#b9482f"],
    [0, 0, -0.24, 4.21, 7.1, -3.84, 2.04, "#bfe6f2"],
    [0, 0, -0.24, -4.31, 4.31, -7.22, 7.22, "#e8402c"],
  ];
  const POIS = [
    ["🎪", "Main Gate", 1.4, -81.5], ["💻", "Founders' Deck · sit & work", -31, 29], ["🛋️", "Mill Terrace · sofa and table", -4.6, 11.6], ["🚀", "Ship It · fireworks button", 10.8, 13.2],
    ["🔥", "Indie Hackers Campfire", 28.6, 40.4], ["🌴", "The 4-Hour Workweek · hammocks", 33.2, 45.2], ["🎡", "The Tim Ferriss Wheel", -57.4, -68], ["🎠", "The Pivot · carousel", 73.8, -12.2],
    ["🎈", "Up and to the Right · balloon", -99.4, -4],
  ];

  function create({ world, hud, entries, presence, net, go, play }) {
    if (typeof document === "undefined" || !hud || !hud.root) return { update() {}, open() {}, close() {}, poi() {} };
    const px = (x) => (x - X0) * S, pz = (z) => (z - Z0) * S;
    const pois = POIS.map(([icon, title, x, z]) => ({ icon, title, x, z }));
    for (const [x, z, heading] of (MF.fest && MF.fest.AD_BOOTHS) || []) pois.push({ icon: "📣", title: "Ad Booth · put your brand in the fair", x: x + Math.sin(heading) * 1.35, z: z + Math.cos(heading) * 1.35 });
    const base = document.createElement("canvas"); // le plan (dessiné une fois)
    base.width = W;
    base.height = H;
    let ready = false;

    /* ---------------------------------------------------------------- le plan illustré */
    function ribbon(c, text, x, y) {
      c.font = `400 25px ${MF.FONT}`;
      const w = c.measureText(text).width + 30;
      c.fillStyle = "#2b1a10";
      MF.roundRect(c, x - w / 2 - 3, y - 19, w + 6, 42, 13);
      c.fill();
      c.fillStyle = "#fff3d6";
      MF.roundRect(c, x - w / 2, y - 16, w, 34, 10);
      c.fill();
      c.fillStyle = "#c0392b";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(text, x, y + 3);
    }
    function paint() {
      const c = base.getContext("2d");
      // relief : un petit canevas (une case de 4 m), agrandi en douceur ; ombrage venu du nord-ouest
      const cw = Math.ceil((X1 - X0) / 4), ch = Math.ceil((Z1 - Z0) / 4), small = document.createElement("canvas");
      small.width = cw;
      small.height = ch;
      const sc = small.getContext("2d"), img = sc.createImageData(cw, ch);
      const hAt = (x, z) => (world.groundAt || world.heightAt)(MF.clamp(x, X0 + 2, X1 - 2), MF.clamp(z, Z0 + 4, Z1 - 2));
      for (let j = 0; j < ch; j++)
        for (let i = 0; i < cw; i++) {
          const x = X0 + i * 4 + 2, z = Z0 + j * 4 + 2, h = hAt(x, z), k = MF.clamp(h / 24, 0, 1);
          const shade = MF.clamp(1 + (hAt(x - 4, z - 4) - hAt(x + 4, z + 4)) * 0.035, 0.72, 1.2), o = (j * cw + i) * 4;
          img.data[o] = MF.clamp((152 - 58 * k) * shade, 0, 255);
          img.data[o + 1] = MF.clamp((214 - 44 * k) * shade, 0, 255);
          img.data[o + 2] = MF.clamp((112 - 36 * k) * shade, 0, 255);
          img.data[o + 3] = 255;
        }
      sc.putImageData(img, 0, 0);
      c.imageSmoothingEnabled = true;
      c.drawImage(small, 0, 0, W, H);
      // l'eau : rivière, étangs, puis les îles
      c.lineJoin = c.lineCap = "round";
      for (const pass of [0, 1])
        for (const [width, ...line] of STREAMS) {
          c.beginPath();
          line.forEach(([x, z], i) => (i ? c.lineTo(px(x), pz(z)) : c.moveTo(px(x), pz(z))));
          c.strokeStyle = pass ? "#58c4f0" : "#ffffff";
          c.lineWidth = width * S + (pass ? 4 : 10);
          c.stroke();
        }
      const poly = (pts) => {
        c.beginPath();
        pts.forEach(([x, z], i) => (i ? c.lineTo(px(x), pz(z)) : c.moveTo(px(x), pz(z))));
        c.closePath();
      };
      for (const p of world.ponds || []) {
        poly(p.poly);
        c.fillStyle = "#58c4f0";
        c.fill();
        c.strokeStyle = "#ffffff";
        c.lineWidth = 5;
        c.stroke();
      }
      for (const isle of world.islands || []) {
        poly(isle);
        c.fillStyle = "#8fd06a";
        c.fill();
        c.strokeStyle = "#4f9a3c";
        c.lineWidth = 3;
        c.stroke();
      }
      // vaguelettes
      c.strokeStyle = "rgba(255,255,255,0.75)";
      c.lineWidth = 3;
      for (const [x, z] of [[-6, 36], [-30, 58], [-52, 84], [4, 60], [-70, 106], [62, -30], [76, -28], [130, -32], [26, -6]]) {
        c.beginPath();
        c.moveTo(px(x) - 14, pz(z));
        c.quadraticCurveTo(px(x) - 7, pz(z) - 6, px(x), pz(z));
        c.quadraticCurveTo(px(x) + 7, pz(z) + 6, px(x) + 14, pz(z));
        c.stroke();
      }
      // les allées de la fête : pointillés crème
      c.setLineDash([14, 12]);
      for (const path of PATHS) {
        c.beginPath();
        path.forEach(([x, z], i) => (i ? c.lineTo(px(x), pz(z)) : c.moveTo(px(x), pz(z))));
        c.strokeStyle = "#7a4a1e";
        c.lineWidth = 9;
        c.stroke();
        c.strokeStyle = "#fff3d6";
        c.lineWidth = 5;
        c.stroke();
      }
      c.setLineDash([]);
      // les arbres : de petites boules, une touche de lumière
      for (const t of world.trees || []) {
        const x = t.x ?? t[0], z = t.z ?? t[1], r = MF.clamp((t.height ?? t[2] ?? 12) * 0.11 * S, 6, 12);
        if (x < X0 || x > X1 || z < Z0 || z > Z1) continue;
        c.fillStyle = "#2f8a3c";
        c.beginPath();
        c.arc(px(x), pz(z), r, 0, 7);
        c.fill();
        c.fillStyle = "#49a851";
        c.beginPath();
        c.arc(px(x) - r * 0.25, pz(z) - r * 0.28, r * 0.55, 0, 7);
        c.fill();
      }
      // les toits (le moulin, sa véranda, la dépendance) et la roue du moulin
      for (const [cx, cz, angle, u0, u1, v0, v1, color] of ROOFS) {
        c.save();
        c.translate(px(cx), pz(cz));
        c.rotate(-angle);
        c.fillStyle = "#2b1a10";
        c.fillRect(u0 * S - 4, v0 * S - 4, (u1 - u0) * S + 8, (v1 - v0) * S + 8);
        c.fillStyle = color;
        c.fillRect(u0 * S, v0 * S, (u1 - u0) * S, (v1 - v0) * S);
        c.fillStyle = "rgba(255,255,255,0.35)";
        c.fillRect(((u0 + u1) / 2) * S - 2, v0 * S, 4, (v1 - v0) * S);
        c.restore();
      }
      c.strokeStyle = "#7a4a1e";
      c.lineWidth = 5;
      c.beginPath();
      c.arc(px(5.6), pz(4.4), 9, 0, 7);
      c.stroke();
      for (const [text, x, z] of ZONES) ribbon(c, text, px(x), pz(z));
      // titre et rose des vents
      c.font = `400 54px ${MF.FONT}`;
      c.textAlign = "left";
      c.lineWidth = 12;
      c.strokeStyle = "#2b1a10";
      c.strokeText("DREAM MILL FEST", 34, 62);
      c.fillStyle = "#ffc93a";
      c.fillText("DREAM MILL FEST", 34, 62);
      c.font = `400 26px ${MF.FONT}`;
      c.lineWidth = 7;
      c.strokeText("PARK MAP · click a badge to go there", 36, 108);
      c.fillStyle = "#fff3d6";
      c.fillText("PARK MAP · click a badge to go there", 36, 108);
      c.fillStyle = "#2b1a10";
      c.beginPath();
      c.moveTo(W - 70, 36);
      c.lineTo(W - 52, 96);
      c.lineTo(W - 70, 82);
      c.lineTo(W - 88, 96);
      c.fill();
      c.font = `400 28px ${MF.FONT}`;
      c.textAlign = "center";
      c.fillText("N", W - 70, 122);
      // cadre rayé, comme un chapiteau
      for (let i = 0; i * 40 < W + H; i++) {
        c.fillStyle = i % 2 ? "#fff3d6" : "#e8402c";
        c.fillRect(i * 40, 0, 40, 10);
        c.fillRect(i * 40, H - 10, 40, 10);
        c.fillRect(0, i * 40, 10, 40);
        c.fillRect(W - 10, i * 40, 10, 40);
      }
      ready = true;
    }

    /* ---------------------------------------------------------------- les deux vues */
    const mini = document.createElement("button");
    mini.type = "button";
    mini.className = "fete-minimap";
    mini.title = "Park map (M)";
    mini.innerHTML = `<canvas width="264" height="264"></canvas><span>MAP <kbd>M</kbd></span>`;
    hud.root.appendChild(mini);
    const mc = mini.firstChild.getContext("2d");
    const big = document.createElement("div");
    big.className = "fete-parkmap";
    big.hidden = true;
    big.innerHTML = `<div class="fete-parkmap-frame"><div class="fete-parkmap-plan"><canvas width="${W}" height="${H}"></canvas><div class="fete-parkmap-tip" hidden></div><p class="fete-parkmap-count"></p></div><aside class="fete-parkmap-legend"><h2>🎟️ Park map</h2><p>Click a badge or a name to go there.</p><div data-legend></div></aside><button type="button" class="fete-btn fete-parkmap-close" aria-label="Close the map" title="Close (M)">✕</button></div>`;
    hud.root.appendChild(big);
    const bcv = big.querySelector("canvas"), bc = bcv.getContext("2d"), tip = big.querySelector(".fete-parkmap-tip"), count = big.querySelector(".fete-parkmap-count"), legend = big.querySelector("[data-legend]");
    let open = false, timer = 0, hover = null;

    /** Tout ce qui se clique : jeux, lieux. */
    function badges() {
      const list = entries.filter((e) => !e.broken).map((e) => ({ kind: "game", id: e.def.id, icon: e.def.icon, title: e.def.title, sub: e.def.blurb, color: e.def.color, x: e.def.station.x, z: e.def.station.z }));
      for (const p of pois) list.push({ kind: "poi", icon: p.icon, title: p.title, color: "#ffffff", x: p.x, z: p.z });
      for (const b of list) ((b.px = px(b.x)), (b.py = pz(b.z)));
      for (let pass = 0; pass < 14; pass++)
        for (let i = 0; i < list.length; i++)
          for (let j = i + 1; j < list.length; j++) {
            const a = list[i], b = list[j], dx = b.px - a.px, dy = b.py - a.py, d = Math.hypot(dx, dy) || 0.01;
            if (d >= GAP) continue;
            const push = (GAP - d) / 2, ux = dx / d, uy = dy / d;
            a.px -= ux * push;
            a.py -= uy * push;
            b.px += ux * push;
            b.py += uy * push;
          }
      return list;
    }
    function people() {
      const me = world.player.pose(), seat = MF.app && MF.app.seated && MF.app.seated(), list = [];
      for (const r of presence.list()) list.push({ x: r.x, z: r.z, name: r.peer.name, color: r.peer.color });
      list.push({ x: seat ? seat.x : me.x, z: seat ? seat.z : me.z, name: net.self.name, color: net.self.color, self: true, heading: me.heading });
      return list;
    }
    function drawBadge(c, b, r, lit) {
      const x = b.px, y = b.py;
      c.fillStyle = "rgba(43,26,16,0.35)";
      c.beginPath();
      c.arc(x + 2, y + 4, r + 3, 0, 7);
      c.fill();
      c.fillStyle = lit ? "#ffc93a" : "#ffffff";
      c.beginPath();
      c.arc(x, y, r + 3, 0, 7);
      c.fill();
      c.fillStyle = b.kind === "game" ? b.color || "#e8402c" : "#fff3d6";
      c.beginPath();
      c.arc(x, y, r, 0, 7);
      c.fill();
      c.strokeStyle = "#2b1a10";
      c.lineWidth = 3;
      c.beginPath();
      c.arc(x, y, r + 3, 0, 7);
      c.stroke();
      c.font = `${Math.round(r * 1.25)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(b.icon || "•", x, y + 2);
    }
    function drawPeople(c, list, r, names) {
      for (const p of list) {
        const x = px(p.x), y = pz(p.z);
        if (p.self) {
          c.fillStyle = "rgba(255,255,255,0.45)";
          c.beginPath();
          c.arc(x, y, r * 2.4, 0, 7);
          c.fill();
        }
        c.fillStyle = "#2b1a10";
        c.beginPath();
        c.arc(x, y, r + 4, 0, 7);
        c.fill();
        c.fillStyle = "#ffffff";
        c.beginPath();
        c.arc(x, y, r + 2, 0, 7);
        c.fill();
        c.fillStyle = p.color || "#e8402c";
        c.beginPath();
        c.arc(x, y, r, 0, 7);
        c.fill();
        if (!names) continue;
        c.font = `400 22px ${MF.FONT}`;
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.lineWidth = 6;
        c.strokeStyle = "#2b1a10";
        const label = p.self ? "YOU" : p.name;
        c.strokeText(label, x, y - r - 16);
        c.fillStyle = p.self ? "#ffc93a" : "#ffffff";
        c.fillText(label, x, y - r - 16);
      }
    }
    const esc = (t) => String(t).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
    let legendKey = "";
    function fillLegend(list) {
      const all = badges(), key = all.length + "|" + list.map((p) => p.name).join(",");
      if (key === legendKey) return;
      legendKey = key;
      const row = (b, i) => `<button type="button" data-badge="${i}"><i style="background:${b.kind === "game" ? b.color || "#e8402c" : "#fff3d6"}">${b.icon || "•"}</i><span>${esc(b.title)}</span></button>`;
      const games = all.map((b, i) => (b.kind === "game" ? row(b, i) : "")).join(""), spots = all.map((b, i) => (b.kind === "poi" ? row(b, i) : "")).join("");
      const folks = list.map((p) => `<li><i style="background:${esc(p.color || "#e8402c")}"></i>${esc(p.self ? p.name + " (you)" : p.name)}</li>`).join("");
      legend.innerHTML = `<h3>Rides &amp; places</h3><div class="fete-parkmap-list">${spots}</div><h3>Games (${all.filter((b) => b.kind === "game").length})</h3><div class="fete-parkmap-list">${games}</div><h3>In the park now (${list.length})</h3><ul class="fete-parkmap-people">${folks}</ul>`;
    }
    function act(b) {
      if (!b) return;
      api.close();
      if (b.kind === "game") play(b.id);
      else go(b.x, b.z, 0);
    }
    legend.addEventListener("click", (ev) => {
      const t = ev.target.closest("[data-badge]");
      if (t) act(badges()[+t.dataset.badge]);
    });
    legend.addEventListener("pointerover", (ev) => {
      const t = ev.target.closest("[data-badge]"), b = t && badges()[+t.dataset.badge], was = hover;
      hover = b ? b.title : null;
      if (was !== hover) drawBig();
    });
    function drawBig() {
      if (!ready) paint();
      bc.clearRect(0, 0, W, H);
      bc.drawImage(base, 0, 0);
      for (const b of badges()) drawBadge(bc, b, 19, hover === b.title);
      const main = MF.sponsors ? MF.sponsors.get("fest-carte") : null, credit = main && main.taken ? "PRESENTED BY " + main.name.toUpperCase() : "YOUR BRAND HERE · MAIN SPONSOR";
      bc.font = `400 24px ${MF.FONT}`;
      const cw = bc.measureText(credit).width + 36;
      bc.fillStyle = "#2b1a10";
      MF.roundRect(bc, W - cw - 30, H - 70, cw + 6, 46, 14);
      bc.fill();
      bc.fillStyle = main && main.taken ? main.bg : "#fff3d6";
      MF.roundRect(bc, W - cw - 27, H - 67, cw, 40, 11);
      bc.fill();
      bc.fillStyle = main && main.taken ? main.fg : "#c0392b";
      bc.textAlign = "center";
      bc.textBaseline = "middle";
      bc.fillText(credit, W - cw / 2 - 27, H - 45);
      const list = people();
      drawPeople(bc, list, 9, true);
      count.textContent = list.length + (list.length > 1 ? " makers in the park right now" : " maker in the park right now: you");
      fillLegend(list);
    }
    function drawMini() {
      if (!ready) paint();
      const me = people().find((p) => p.self), R = 62; // rayon vu (m)
      mc.save();
      mc.clearRect(0, 0, 264, 264);
      mc.beginPath();
      mc.arc(132, 132, 130, 0, 7);
      mc.clip();
      const k = 132 / (R * S);
      mc.translate(132 - px(me.x) * k, 132 - pz(me.z) * k);
      mc.scale(k, k);
      mc.drawImage(base, 0, 0);
      for (const b of badges()) if (Math.hypot(b.x - me.x, b.z - me.z) < R + 8) drawBadge(mc, b, 15, false);
      drawPeople(mc, people(), 9, false);
      mc.restore();
    }
    /** La pastille sous le pointeur (coordonnées de la page). */
    function pick(ev) {
      const rect = bcv.getBoundingClientRect(), x = ((ev.clientX - rect.left) / rect.width) * W, y = ((ev.clientY - rect.top) / rect.height) * H;
      let best = null, bd = 30;
      for (const b of badges()) {
        const d = Math.hypot(b.px - x, b.py - y);
        if (d < bd) ((best = b), (bd = d));
      }
      return best;
    }
    bcv.addEventListener("pointermove", (ev) => {
      const b = pick(ev), was = hover;
      hover = b ? b.title : null;
      bcv.style.cursor = b ? "pointer" : "default";
      tip.hidden = !b;
      if (b) {
        const frame = bcv.parentNode.getBoundingClientRect();
        tip.textContent = b.icon + "  " + b.title + (b.kind === "game" ? " · click to play" : " · click to go");
        tip.style.left = MF.clamp(ev.clientX - frame.left, 90, frame.width - 90) + "px";
        tip.style.top = ev.clientY - frame.top - 44 + "px";
      }
      if (was !== hover) drawBig();
    });
    bcv.addEventListener("click", (ev) => act(pick(ev)));
    mini.addEventListener("click", () => api.open());
    big.addEventListener("click", (ev) => (ev.target === big || ev.target.closest(".fete-parkmap-close")) && api.close());
    addEventListener("keydown", (ev) => {
      if (ev.repeat || ev.ctrlKey || ev.metaKey || ev.altKey || /INPUT|TEXTAREA|SELECT/.test((ev.target && ev.target.tagName) || "")) return;
      if (ev.key === "m" || ev.key === "M") (open ? api.close : api.open)();
      else if (ev.key === "Escape" && open) api.close();
    });
    if (MF.whenFont) MF.whenFont(() => (ready = false));

    const api = {
      open() {
        open = true;
        big.hidden = false;
        hover = null;
        drawBig();
      },
      close() {
        open = false;
        big.hidden = true;
        tip.hidden = true;
      },
      isOpen: () => open,
      /** Un lieu de plus sur la carte (guichet, embarcadère…). */
      poi(icon, title, x, z) {
        pois.push({ icon, title, x, z });
      },
      /** Rafraîchit la petite carte (deux fois par seconde) et la grande quand elle est ouverte. */
      update(dt, hidden) {
        mini.hidden = !!hidden;
        timer -= dt;
        if (timer > 0) return;
        timer = 0.5;
        if (open) drawBig();
        else if (!hidden) drawMini();
      },
    };
    return api;
  }

  MF.ParkMap = { create };
})();
