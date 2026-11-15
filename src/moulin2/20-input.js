// La Fête du Moulin — commandes des mini-jeux : clavier, souris, écran tactile, manette.
//
// Pendant un jeu, une couche transparente recouvre la vue 3D : elle reçoit les gestes (le moulin
// lui-même ne les voit plus) et porte les commandes tactiles. Chaque jeu choisit sa disposition :
//
//   input.use({ layout, buttons, radio })
//     layout "pilot"   : un manche à gauche (x, y) — auto-tamponneuses…
//            "radio"   : télécommande de modélisme, manche gauche vertical (y : gaz), manche droit
//                        horizontal (x : direction), marque du sponsor au milieu — voitures, bateaux
//            "dual"    : deux manches complets (x2, y2 à gauche ; x, y à droite) — drones ; avec radio:
//                        { brand }, le boîtier de la radiocommande s'affiche aussi
//            "pointer" : pas de manche, on vise ou on tire en glissant sur l'écran — golf, tir, pêche…
//     buttons : [{ id: "a", label: "Klaxon", key: "Espace" }] (a : Espace, b : Maj ou E, c : C ou X)
//     radio   : { brand: "Nom du sponsor" } (texte au milieu de la télécommande)
//   input.state → { x, y, x2, y2 (−1..1), a, b, c (maintenus), hit: { a, b, c } (vient d'être appuyé),
//                   pointer: { x, y (px dans la vue), nx, ny (−1..1, y vers le haut), isDown, down, up (fronts),
//                              dx, dy (glissé depuis l'appui, px), startX, startY, moved } }
//   input.update() à chaque image ; input.release() en quittant le jeu.
//
// Clavier : flèches ou ZQSD/WASD pour x, y ; IJKL pour x2, y2 ; Espace (a) ; Maj ou E (b) ; C ou X (c).
(function () {
  "use strict";
  const MF = (globalThis.MoulinFete = globalThis.MoulinFete || {});
  const h = (tag, cls, parent, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    if (parent) parent.appendChild(el);
    return el;
  };

  function create({ dom, mobile }) {
    const layer = h("div", "fete-touch", dom);
    layer.hidden = true;
    const keys = new Set();
    const state = { x: 0, y: 0, x2: 0, y2: 0, a: false, b: false, c: false, hit: { a: false, b: false, c: false }, pointer: { x: 0, y: 0, nx: 0, ny: 0, isDown: false, down: false, up: false, dx: 0, dy: 0, startX: 0, startY: 0, moved: false, id: null } };
    const prev = { a: false, b: false, c: false };
    const sticks = []; // { el, knob, axisX, axisY, id, vx, vy, kx, ky (noms des champs) }
    const touchBtn = { a: false, b: false, c: false };
    let scheme = null, active = false, pDown = false, pUp = false, radioEl = null;
    const touch = !!mobile || (typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches);

    const KEYMAP = {
      arrowup: ["y", 1], z: ["y", 1], w: ["y", 1], arrowdown: ["y", -1], s: ["y", -1],
      arrowleft: ["x", -1], q: ["x", -1], a: ["x", -1], arrowright: ["x", 1], d: ["x", 1],
      i: ["y2", 1], k: ["y2", -1], j: ["x2", -1], l: ["x2", 1],
    };
    const BTNKEY = { " ": "a", spacebar: "a", shift: "b", e: "b", c: "c", x: "c" };
    function onKey(ev, down) {
      if (!active) return;
      if (ev.target && ev.target.closest && ev.target.closest("input,textarea,select,[contenteditable='true']")) return;
      const k = (ev.key || "").toLowerCase();
      if (KEYMAP[k] || BTNKEY[k]) {
        if (down) keys.add(k);
        else keys.delete(k);
        ev.preventDefault();
        ev.stopPropagation();
      }
    }
    const kd = (ev) => onKey(ev, true), ku = (ev) => onKey(ev, false);
    const blur = () => keys.clear();

    function makeStick(side, axisX, axisY, kx, ky, label) {
      const el = h("div", "fete-stick fete-stick-" + side + (axisX && axisY ? "" : axisX ? " is-h" : " is-v"), layer);
      const knob = h("i", "", el);
      if (label) h("span", "", el, label);
      const st = { el, knob, axisX, axisY, kx, ky, id: null, vx: 0, vy: 0 };
      const set = (ev) => {
        const r = el.getBoundingClientRect();
        const half = r.width / 2;
        let dx = (ev.clientX - (r.left + half)) / (half * 0.72), dy = -(ev.clientY - (r.top + r.height / 2)) / ((r.height / 2) * 0.72);
        if (!axisX) dx = 0;
        if (!axisY) dy = 0;
        const l = Math.hypot(dx, dy);
        if (l > 1) {
          dx /= l;
          dy /= l;
        }
        st.vx = dx;
        st.vy = dy;
        knob.style.transform = `translate(${(dx * half * 0.6).toFixed(1)}px, ${(-dy * (r.height / 2) * 0.6).toFixed(1)}px)`;
      };
      el.addEventListener("pointerdown", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        st.id = ev.pointerId;
        try {
          el.setPointerCapture(ev.pointerId);
        } catch (e) {}
        set(ev);
      });
      el.addEventListener("pointermove", (ev) => {
        if (ev.pointerId === st.id) set(ev);
      });
      const end = (ev) => {
        if (ev.pointerId !== st.id) return;
        st.id = null;
        st.vx = st.vy = 0;
        knob.style.transform = "";
      };
      for (const name of ["pointerup", "pointercancel", "lostpointercapture"]) el.addEventListener(name, end);
      sticks.push(st);
      return st;
    }
    function makeButton(def, index) {
      const el = h("button", "fete-tbtn fete-tbtn-" + def.id, layer);
      el.type = "button";
      el.style.setProperty("--i", index);
      h("b", "", el, def.label || def.id.toUpperCase());
      if (def.key && !touch) h("kbd", "", el, def.key);
      const set = (v) => {
        touchBtn[def.id] = v;
        el.classList.toggle("is-held", v);
      };
      el.addEventListener("pointerdown", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        try {
          el.setPointerCapture(ev.pointerId);
        } catch (e) {}
        set(true);
      });
      for (const name of ["pointerup", "pointercancel", "lostpointercapture"]) el.addEventListener(name, () => set(false));
    }

    // gestes libres sur la vue (viser, tirer, glisser)
    const P = state.pointer;
    function local(ev) {
      const r = layer.getBoundingClientRect();
      P.x = ev.clientX - r.left;
      P.y = ev.clientY - r.top;
      P.nx = (P.x / Math.max(1, r.width)) * 2 - 1;
      P.ny = -((P.y / Math.max(1, r.height)) * 2 - 1);
    }
    layer.addEventListener("pointerdown", (ev) => {
      if (ev.target !== layer) return;
      ev.preventDefault();
      if (P.id !== null) return;
      P.id = ev.pointerId;
      try {
        layer.setPointerCapture(ev.pointerId);
      } catch (e) {}
      local(ev);
      P.isDown = true;
      pDown = true;
      P.startX = P.x;
      P.startY = P.y;
      P.dx = P.dy = 0;
      P.moved = false;
    });
    layer.addEventListener("pointermove", (ev) => {
      if (P.id !== null && ev.pointerId !== P.id) return;
      if (P.id === null && ev.pointerType !== "mouse") return;
      local(ev);
      if (P.isDown) {
        P.dx = P.x - P.startX;
        P.dy = P.y - P.startY;
        if (Math.hypot(P.dx, P.dy) > 6) P.moved = true;
      }
    });
    const pEnd = (ev) => {
      if (ev.pointerId !== P.id) return;
      P.id = null;
      if (P.isDown) pUp = true;
      P.isDown = false;
    };
    for (const name of ["pointerup", "pointercancel", "lostpointercapture"]) layer.addEventListener(name, pEnd);
    layer.addEventListener("contextmenu", (ev) => ev.preventDefault());

    const input = {
      state,
      touch,
      layer,
      /** Active les commandes d'un jeu (voir l'en-tête). */
      use(s) {
        input.release();
        scheme = Object.assign({ layout: "pilot", buttons: [] }, s || {});
        active = true;
        layer.hidden = false;
        layer.dataset.layout = scheme.layout;
        layer.classList.toggle("is-touch", touch);
        if (scheme.layout === "pilot") {
          if (touch) makeStick("left", true, true, "x", "y");
        } else if (scheme.layout === "radio") {
          radioEl = h("div", "fete-radio", layer);
          h("div", "fete-radio-antenna", radioEl);
          const brand = h("div", "fete-radio-brand", radioEl);
          h("small", "", brand, (scheme.radio && scheme.radio.kicker) || "TÉLÉCOMMANDE");
          h("b", "", brand, (scheme.radio && scheme.radio.brand) || "VOTRE MARQUE ICI");
          makeStick("left", false, true, null, "y", "GAZ");
          makeStick("right", true, false, "x", null, "DIRECTION");
        } else if (scheme.layout === "dual") {
          if (scheme.radio) {
            // radiocommande à deux manches : même boîtier, avec la marque du sponsor au milieu
            radioEl = h("div", "fete-radio", layer);
            h("div", "fete-radio-antenna", radioEl);
            const brand = h("div", "fete-radio-brand", radioEl);
            h("small", "", brand, scheme.radio.kicker || "RADIOCOMMANDE");
            h("b", "", brand, scheme.radio.brand || "VOTRE MARQUE ICI");
          }
          makeStick("left", true, true, "x2", "y2", scheme.leftLabel || "");
          makeStick("right", true, true, "x", "y", scheme.rightLabel || "");
        }
        (scheme.buttons || []).forEach(makeButton);
        addEventListener("keydown", kd, true);
        addEventListener("keyup", ku, true);
        addEventListener("blur", blur);
      },
      release() {
        if (!active) return;
        active = false;
        scheme = null;
        layer.hidden = true;
        layer.textContent = "";
        radioEl = null;
        sticks.length = 0;
        keys.clear();
        touchBtn.a = touchBtn.b = touchBtn.c = false;
        P.id = null;
        P.isDown = false;
        removeEventListener("keydown", kd, true);
        removeEventListener("keyup", ku, true);
        removeEventListener("blur", blur);
        Object.assign(state, { x: 0, y: 0, x2: 0, y2: 0, a: false, b: false, c: false });
      },
      /** Change le texte du milieu de la télécommande (nom du sponsor). */
      setBrand(text) {
        const b = radioEl && radioEl.querySelector(".fete-radio-brand b");
        if (b) b.textContent = text;
      },
      update() {
        if (!active) return;
        let x = 0, y = 0, x2 = 0, y2 = 0;
        for (const k of keys) {
          const m = KEYMAP[k];
          if (!m) continue;
          if (m[0] === "x") x += m[1];
          else if (m[0] === "y") y += m[1];
          else if (m[0] === "x2") x2 += m[1];
          else y2 += m[1];
        }
        let a = touchBtn.a, b = touchBtn.b, c = touchBtn.c;
        for (const k of keys) {
          const bk = BTNKEY[k];
          if (bk === "a") a = true;
          else if (bk === "b") b = true;
          else if (bk === "c") c = true;
        }
        for (const st of sticks) {
          if (st.id === null) {
            // sans doigt dessus, le manche suit le clavier (on voit la télécommande bouger)
            const kx = st.kx === "x" ? x : st.kx === "x2" ? x2 : 0, ky = st.ky === "y" ? y : st.ky === "y2" ? y2 : 0;
            const r = st.el.clientWidth / 2;
            st.knob.style.transform = kx || ky ? `translate(${(MF.clamp(kx, -1, 1) * r * 0.6).toFixed(1)}px, ${(-MF.clamp(ky, -1, 1) * (st.el.clientHeight / 2) * 0.6).toFixed(1)}px)` : "";
            continue;
          }
          if (st.kx === "x") x += st.vx;
          else if (st.kx === "x2") x2 += st.vx;
          if (st.ky === "y") y += st.vy;
          else if (st.ky === "y2") y2 += st.vy;
        }
        // manette (disposition standard) : stick gauche, stick droit, boutons 0, 1, 2 et gâchettes
        const pads = typeof navigator !== "undefined" && navigator.getGamepads ? navigator.getGamepads() : [];
        for (const pad of pads || []) {
          if (!pad || !pad.connected) continue;
          const dz = (v) => (Math.abs(v) < 0.14 ? 0 : v);
          const lx = dz(pad.axes[0] || 0), ly = dz(pad.axes[1] || 0), rx = dz(pad.axes[2] || 0), ry = dz(pad.axes[3] || 0);
          const rt = pad.buttons[7] ? pad.buttons[7].value : 0, lt = pad.buttons[6] ? pad.buttons[6].value : 0;
          if (scheme && scheme.layout === "dual") {
            x2 += lx;
            y2 -= ly;
            x += rx;
            y -= ry;
          } else {
            x += lx || rx;
            y += rt - lt || -ly;
          }
          a = a || !!(pad.buttons[0] && pad.buttons[0].pressed);
          b = b || !!(pad.buttons[1] && pad.buttons[1].pressed);
          c = c || !!(pad.buttons[2] && pad.buttons[2].pressed);
          break;
        }
        state.x = MF.clamp(x, -1, 1);
        state.y = MF.clamp(y, -1, 1);
        state.x2 = MF.clamp(x2, -1, 1);
        state.y2 = MF.clamp(y2, -1, 1);
        state.hit.a = a && !prev.a;
        state.hit.b = b && !prev.b;
        state.hit.c = c && !prev.c;
        prev.a = state.a = a;
        prev.b = state.b = b;
        prev.c = state.c = c;
        P.down = pDown;
        P.up = pUp;
        pDown = pUp = false;
      },
    };
    return input;
  }

  MF.Input = { create };
})();
