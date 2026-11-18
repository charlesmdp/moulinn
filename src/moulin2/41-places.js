// La Fête du Moulin — lieux où l'on peut agir en se promenant : s'asseoir sur un pouf, monter dans
// la grande roue… Le cœur affiche une invite (« Sit: Founders' Deck — E ») quand on s'en approche.
//
//   const places = MF.Places.create();
//   places.add({ id, x, z, r, icon, title, verb, when(), run(place) })   r : distance d'invite (m)
//   places.near(x, z) → le lieu le plus proche à portée (et disponible), ou null ; places.run(id)
(function () {
  "use strict";
  const MF = (globalThis.MoulinFete = globalThis.MoulinFete || {});
  function create() {
    const list = [];
    return {
      list,
      add(place) {
        list.push(place);
        return place;
      },
      near(x, z) {
        let best = null, bd = Infinity;
        for (const p of list) {
          const d = Math.hypot(x - p.x, z - p.z);
          if (d < (p.r || 1.5) && d < bd && (!p.when || p.when())) {
            best = p;
            bd = d;
          }
        }
        return best;
      },
      run(id) {
        const p = list.find((q) => q.id === id);
        if (p && (!p.when || p.when())) p.run(p);
      },
    };
  }
  MF.Places = { create };
})();
