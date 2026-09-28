// « Pas touche à mes trésors » — géométrie 2D (plan x, z en U) pour la simulation.
(function () {
  "use strict";
  const PTMT = (globalThis.PTMT = globalThis.PTMT || {});

  const G = {
    dist(a, b) {
      return Math.hypot(a[0] - b[0], a[1] - b[1]);
    },
    dist2(ax, az, bx, bz) {
      const dx = ax - bx,
        dz = az - bz;
      return dx * dx + dz * dz;
    },
    lerp(a, b, t) {
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    },
    /** Polyligne avec longueurs cumulées : { pts, cum, length }. */
    polyline(pts) {
      const cum = [0];
      for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + G.dist(pts[i - 1], pts[i]));
      return { pts, cum, length: cum[cum.length - 1] };
    },
    /** Position et direction à l'abscisse s le long d'une polyligne. */
    at(line, s, out) {
      const { pts, cum } = line;
      out = out || { x: 0, z: 0, dx: 0, dz: 1, seg: 0 };
      if (pts.length === 1) {
        out.x = pts[0][0];
        out.z = pts[0][1];
        return out;
      }
      s = Math.max(0, Math.min(line.length, s));
      let lo = 0,
        hi = cum.length - 1;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (cum[mid] <= s) lo = mid;
        else hi = mid;
      }
      const a = pts[lo],
        b = pts[hi],
        len = cum[hi] - cum[lo] || 1e-9,
        t = (s - cum[lo]) / len;
      out.x = a[0] + (b[0] - a[0]) * t;
      out.z = a[1] + (b[1] - a[1]) * t;
      out.dx = (b[0] - a[0]) / len;
      out.dz = (b[1] - a[1]) / len;
      out.seg = lo;
      return out;
    },
    /** Projection d'un point sur une polyligne : { s, d, x, z } (s dans [s0, s1] si fourni). */
    project(line, x, z, s0 = 0, s1 = Infinity) {
      const { pts, cum } = line;
      let best = { s: Math.max(0, Math.min(line.length, s0)), d: Infinity, x: pts[0][0], z: pts[0][1] };
      for (let i = 0; i < pts.length - 1; i++) {
        if (cum[i + 1] < s0 || cum[i] > s1) continue;
        const a = pts[i],
          b = pts[i + 1],
          vx = b[0] - a[0],
          vz = b[1] - a[1],
          len2 = vx * vx + vz * vz || 1e-9;
        let t = ((x - a[0]) * vx + (z - a[1]) * vz) / len2;
        t = Math.max(0, Math.min(1, t));
        let s = cum[i] + Math.sqrt(len2) * t;
        if (s < s0 || s > s1) {
          s = Math.max(s0, Math.min(s1, s));
          const p = G.at(line, s);
          const d = Math.hypot(p.x - x, p.z - z);
          if (d < best.d) best = { s, d, x: p.x, z: p.z };
          continue;
        }
        const px = a[0] + vx * t,
          pz = a[1] + vz * t,
          d = Math.hypot(px - x, pz - z);
        if (d < best.d) best = { s, d, x: px, z: pz };
      }
      return best;
    },
    pointInPolygon(x, z, poly) {
      let inside = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i][0],
          zi = poly[i][1],
          xj = poly[j][0],
          zj = poly[j][1];
        if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
      }
      return inside;
    },
    segmentsCross(ax, az, bx, bz, cx, cz, dx, dz) {
      const d1 = (dx - cx) * (az - cz) - (dz - cz) * (ax - cx),
        d2 = (dx - cx) * (bz - cz) - (dz - cz) * (bx - cx),
        d3 = (bx - ax) * (cz - az) - (bz - az) * (cx - ax),
        d4 = (bx - ax) * (dz - az) - (bz - az) * (dx - ax);
      return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
    },
    /** Le segment [a, b] traverse-t-il le polygone (bâtiment opaque) ? */
    segmentHitsPolygon(ax, az, bx, bz, poly) {
      if (G.pointInPolygon(ax, az, poly) || G.pointInPolygon(bx, bz, poly)) return true;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++)
        if (G.segmentsCross(ax, az, bx, bz, poly[j][0], poly[j][1], poly[i][0], poly[i][1])) return true;
      return false;
    },
    /** Distance d'un point à un segment. */
    segDist(x, z, a, b) {
      const vx = b[0] - a[0],
        vz = b[1] - a[1],
        len2 = vx * vx + vz * vz || 1e-9;
      let t = ((x - a[0]) * vx + (z - a[1]) * vz) / len2;
      t = Math.max(0, Math.min(1, t));
      return Math.hypot(a[0] + vx * t - x, a[1] + vz * t - z);
    },
    polylineDist(x, z, pts) {
      let d = Infinity;
      for (let i = 0; i < pts.length - 1; i++) d = Math.min(d, G.segDist(x, z, pts[i], pts[i + 1]));
      return d;
    },
    polygonArea(poly) {
      let a = 0;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) a += (poly[j][0] + poly[i][0]) * (poly[j][1] - poly[i][1]);
      return Math.abs(a / 2);
    },
    /** Angle entre la direction (dx, dz) et le vecteur vers (x, z) depuis (ox, oz). */
    angleTo(ox, oz, dx, dz, x, z) {
      const vx = x - ox,
        vz = z - oz,
        l = Math.hypot(vx, vz) || 1e-9;
      return Math.acos(Math.max(-1, Math.min(1, (vx * dx + vz * dz) / l)));
    },
    /** Transforme un point local (module) : rotation (radians, sens trigonométrique vu du dessus) puis translation. */
    xform(p, t) {
      const c = Math.cos(t.rot || 0),
        s = Math.sin(t.rot || 0),
        m = t.mirror ? -1 : 1;
      const x = p[0] * m,
        z = p[1];
      return [t.x + x * c - z * s, t.z + x * s + z * c];
    },
  };

  PTMT.geom = G;
})();
