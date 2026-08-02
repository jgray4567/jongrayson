/**
 * orbital-layer.js — Space picture
 *
 * The reported problem was "satellites are hard to see". They were, and the
 * reasons were structural rather than cosmetic:
 *
 *   · 0.03-unit spheres against a star field, at up to 588 objects. At the
 *     default camera distance that is roughly two pixels — indistinguishable
 *     from the background stars they were drawn on top of.
 *   · Additive blending, so each one was a faint smear rather than a shape.
 *   · Violet/orange/red orbit classes collided with the earthquake and
 *     weather palettes. An operator could not tell a GEO bird from a seismic
 *     event by colour alone.
 *   · Altitude was crushed through min(alt/6371, 6) × 0.15, which put a
 *     550 km LEO satellite 0.065 units above the surface — visually *on* the
 *     terrain — while GEO sat at 4.2 units. The vertical relationship between
 *     orbital shells, the single most important thing about this picture, was
 *     unreadable.
 *   · A separate invisible hit-sphere per satellite, doubling the object
 *     count purely to make clicking work.
 *
 * This version: one InstancedMesh per shell class, a logarithmic altitude
 * mapping with drawn-and-labelled reference shells so the compression is
 * explicit rather than misleading, a hard screen-space size floor, and
 * screen-space picking.
 */

import * as THREE from 'three';
import {
  EARTH_RADIUS, DEG2RAD, RAD2DEG, PALETTE, latLngTo3D, vec3ToLatLng,
  screenScale, registry, selection, feeds, fetchWithTimeout,
} from './intel-core.js';

const DOT_PX = 8;
const DOT_FLOOR_PX = 6;      // legibility floor — never a sub-pixel speck
const DOT_CEIL_PX = 18;
const HALO_SCALE = 1.45;     // just enough dark edge to separate from stars
const PICK_RADIUS_PX = 16;

/**
 * Altitude → render radius.
 *
 * Linear-to-scale is unusable (GEO would be 5.6 Earth radii out, LEO would be
 * inside the atmosphere glow). Logarithmic compression preserves the ordering
 * and the *sense* of separation between shells while keeping everything on
 * screen. The reference shells drawn by _buildShells() make the compression
 * legible instead of deceptive — you can see that the LEO band is a band.
 */
function altToRadius(altKm) {
  const a = Math.max(80, altKm || 0);
  const t = Math.log(a / 80) / Math.log(36000 / 80);   // 0 at 80 km, 1 at GEO
  return EARTH_RADIUS + 0.28 + t * 4.4;
}

const SHELLS = [
  { key: 'LEO', label: 'LEO', altKm: 550,   note: '160 – 2 000 km' },
  { key: 'MEO', label: 'MEO', altKm: 20200, note: '2 000 – 35 000 km' },
  { key: 'GEO', label: 'GEO', altKm: 35786, note: 'geostationary' },
];

export class OrbitalLayer {
  constructor({ scene, camera, satellite, capacity = 2000, endpoint = '../../api/satellite-tracker.php' }) {
    this.scene = scene;
    this.camera = camera;
    this.sat = satellite;              // satellite.js namespace
    this.capacity = capacity;
    this.endpoint = endpoint;
    this.visible = true;
    this.showPaths = false;
    this.showShells = true;
    this.filters = { LEO: true, MEO: true, GEO: true };

    this.sats = [];                    // [{ id, name, network, orbitClass, satrec, ... }]
    this.active = [];                  // filtered, in instance order

    this._build();
    feeds.register('satellites', {
      label: 'Orbital Assets',
      cadenceMs: 60 * 1000,
      source: 'CelesTrak TLE · SGP4 propagation (satellite.js)',
    });

    this._m4 = new THREE.Matrix4();
    this._v = new THREE.Vector3();
    this._v2 = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3();
    this._c = new THREE.Color();
    this._proj = new THREE.Vector3();
  }

  _build() {
    this.group = new THREE.Group();
    this.group.name = 'orbital';
    this.scene.add(this.group);

    // Octahedron rather than a sphere: at 5–7 px an octahedron reads as a
    // deliberate faceted marker, a low-poly sphere reads as a smudge.
    //
    // Radius 0.5, i.e. unit DIAMETER. screenScale() returns the world size for
    // a target pixel span, so the geometry it scales must be one unit across,
    // not one unit in radius — otherwise every marker renders at twice its
    // nominal size (and the halo at ~2.9×, which is what made satellites read
    // as huge diamonds on a phone).
    const geo = new THREE.OctahedronGeometry(0.5, 0);

    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({
      transparent: false, depthTest: true, depthWrite: true, toneMapped: false,
    }), this.capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 8;
    this.group.add(this.mesh);

    // Dark halo so a violet marker stays separable from the star field.
    //
    // MUST be opaque. three.js renders the entire opaque queue before the
    // entire transparent queue, and renderOrder only sorts *within* a queue —
    // so a transparent halo is drawn after every opaque object no matter what
    // renderOrder says, and paints over the very marker it exists to outline.
    // That is exactly what was happening: satellites rendered as dark
    // diamonds with the violet completely covered.
    this.halo = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({
      color: 0x05070c, transparent: false,
      depthTest: true, depthWrite: false, toneMapped: false,
    }), this.capacity);
    this.halo.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.halo.count = 0;
    this.halo.frustumCulled = false;
    this.halo.renderOrder = 7;
    this.group.add(this.halo);

    this.pathsGroup = new THREE.Group();
    this.pathsGroup.visible = false;
    this.group.add(this.pathsGroup);

    this.selGroup = new THREE.Group();
    this.group.add(this.selGroup);

    this._buildShells();
  }

  /**
   * Faint reference shells at LEO / MEO / GEO radii.
   *
   * Without these, the logarithmic altitude compression is a lie the operator
   * cannot detect. With them, the compression is a stated convention: you can
   * see which band a satellite belongs to at a glance and you can see that the
   * bands are not to scale.
   */
  _buildShells() {
    this.shellsGroup = new THREE.Group();
    this.group.add(this.shellsGroup);
    for (const s of SHELLS) {
      const r = altToRadius(s.altKm);
      const geo = new THREE.RingGeometry(r - 0.004, r + 0.004, 180);
      const mat = new THREE.MeshBasicMaterial({
        color: PALETTE.orbit[s.key], transparent: true, opacity: 0.16,
        side: THREE.DoubleSide, depthWrite: false, toneMapped: false,
      });
      const ring = new THREE.Mesh(geo, mat);
      ring.userData.shell = s.key;
      ring.renderOrder = 2;
      this.shellsGroup.add(ring);
    }
  }

  setVisible(v) { this.visible = v; this.group.visible = v; if (!v) feeds.off('satellites'); }
  setShowPaths(v) { this.showPaths = v; this.pathsGroup.visible = v; if (v) this._rebuildPaths(); }
  setShowShells(v) { this.showShells = v; this.shellsGroup.visible = v; }
  setFilter(cls, on) { this.filters[cls] = on; this._applyFilters(); }

  /* ── Data ─────────────────────────────────────────────────────── */

  async fetch() {
    feeds.attempt('satellites');
    try {
      const res = await fetchWithTimeout(this.endpoint, { timeoutMs: 15000 });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const items = data.items || [];

      const out = [];
      for (const s of items) {
        if (!s.tle1 || !s.tle2) continue;
        let satrec;
        try { satrec = this.sat.twoline2satrec(s.tle1, s.tle2); } catch { continue; }
        if (!satrec || satrec.error) continue;
        out.push({
          id: s.name + '|' + (s.noradId || satrec.satnum || ''),
          name: s.name,
          noradId: s.noradId || satrec.satnum,
          network: s.network || 'Unknown',
          orbitClass: s.orbitClass || 'LEO',
          altitudeKm: s.altitudeKm || s.altitude || 0,
          periodMinutes: s.periodMinutes || 0,
          inclination: satrec.inclo ? satrec.inclo * RAD2DEG : null,
          tle1: s.tle1, tle2: s.tle2,
          satrec,
          pos: new THREE.Vector3(),
        });
      }
      this.sats = out;
      this._applyFilters();
      feeds.success('satellites', this.active.length);
    } catch (err) {
      feeds.failure('satellites', err);
      console.warn('[orbital] fetch failed:', err);
    }
  }

  _applyFilters() {
    this.active = this.sats.filter(s => this.filters[s.orbitClass] !== false);
    this.counts = { LEO: 0, MEO: 0, GEO: 0 };
    for (const s of this.sats) this.counts[s.orbitClass] = (this.counts[s.orbitClass] || 0) + 1;
    registry.replace('satellite', this.active.map(s => ({
      id: s.id,
      kind: 'satellite',
      label: s.name,
      sub: s.network + ' · ' + s.orbitClass + ' · ' + Math.round(s.altitudeKm) + ' km',
      keywords: [s.network, s.orbitClass, s.noradId, 'satellite orbit spacecraft'].join(' '),
      get lat() { return s.lat; },
      get lng() { return s.lng; },
      get alt() { return s.altitudeKm * 1000; },
      data: s,
    })));
    if (this.showPaths) this._rebuildPaths();
  }

  /* ── Per-frame ───────────────────────────────────────────────── */

  update(nowDate, viewportH) {
    if (!this.visible || !this.active.length) { this.mesh.count = 0; this.halo.count = 0; return; }

    // SGP4 is not free. Propagating 600 satellites at 60 fps is pure waste —
    // orbital position changes by a few metres between frames. Recompute at
    // 4 Hz and interpolate visually via the render transform.
    const nowMs = nowDate.getTime();
    const needsPropagate = !this._lastProp || nowMs - this._lastProp > 250;
    if (needsPropagate) {
      this._lastProp = nowMs;
      const gmst = this.sat.gstime(nowDate);
      for (const s of this.active) {
        let pv;
        try { pv = this.sat.propagate(s.satrec, nowDate); } catch { s.valid = false; continue; }
        if (!pv || !pv.position || typeof pv.position === 'boolean') { s.valid = false; continue; }
        const geo = this.sat.eciToGeodetic(pv.position, gmst);
        s.lat = geo.latitude * RAD2DEG;
        s.lng = geo.longitude * RAD2DEG;
        s.heightKm = geo.height;
        s.velocityKms = pv.velocity
          ? Math.hypot(pv.velocity.x, pv.velocity.y, pv.velocity.z) : null;
        s.valid = true;
        latLngTo3D(s.lat, s.lng, altToRadius(s.heightKm || s.altitudeKm), s.pos);
      }
    }

    let i = 0;
    for (const s of this.active) {
      if (!s.valid || i >= this.capacity) continue;
      const isSel = selection.is('satellite', s.id);
      const isHov = selection.hovered?.kind === 'satellite' && selection.hovered.id === s.id;
      const px = isSel ? DOT_PX * 2.2 : isHov ? DOT_PX * 1.5 : DOT_PX;
      const sc = screenScale(s.pos, this.camera, px, viewportH, DOT_FLOOR_PX, DOT_CEIL_PX);

      this._s.set(sc, sc, sc);
      this._m4.compose(s.pos, this._q.identity(), this._s);
      this.mesh.setMatrixAt(i, this._m4);

      this._s.multiplyScalar(HALO_SCALE);
      this._m4.compose(s.pos, this._q, this._s);
      this.halo.setMatrixAt(i, this._m4);

      this._c.setHex(isSel ? PALETTE.selection : PALETTE.orbit[s.orbitClass] || PALETTE.orbit.LEO);
      this.mesh.setColorAt(i, this._c);

      s.instanceIndex = i;
      i++;
    }

    this.mesh.count = i;
    this.halo.count = i;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.halo.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;

    this._updateSelection(nowDate);
  }

  /**
   * For the selected satellite: full orbit track, a ground track projected
   * onto the surface, and a tether joining the two. The tether is the part
   * that matters — it answers "what is it actually over right now", which is
   * the only question anyone asks about a satellite.
   */
  _updateSelection(nowDate) {
    const sel = selection.selected;
    const id = sel && sel.kind === 'satellite' ? sel.id : null;
    if (this._selDrawnFor === id && id) { this._updateTether(); return; }
    this._selDrawnFor = id;

    while (this.selGroup.children.length) {
      const c = this.selGroup.children.pop();
      c.geometry?.dispose(); c.material?.dispose();
      this.selGroup.remove(c);
    }
    if (!id) return;
    const s = this.active.find(x => x.id === id);
    if (!s) return;

    const period = (s.periodMinutes || 95) * 60;
    const steps = 180;
    const orbit = [], ground = [];
    for (let k = 0; k <= steps; k++) {
      const t = new Date(nowDate.getTime() + (period * k / steps) * 1000);
      let pv; try { pv = this.sat.propagate(s.satrec, t); } catch { continue; }
      if (!pv || !pv.position || typeof pv.position === 'boolean') continue;
      const g = this.sat.eciToGeodetic(pv.position, this.sat.gstime(t));
      const la = g.latitude * RAD2DEG, ln = g.longitude * RAD2DEG;
      orbit.push(latLngTo3D(la, ln, altToRadius(g.height)));
      ground.push(latLngTo3D(la, ln, EARTH_RADIUS + 0.012));
    }

    if (orbit.length > 2) {
      this.selGroup.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(orbit),
        new THREE.LineBasicMaterial({
          color: PALETTE.selection, transparent: true, opacity: 0.75,
          depthTest: true, toneMapped: false,
        })));
    }
    if (ground.length > 2) {
      // Ground track is drawn in segments so the antimeridian wrap does not
      // draw a line straight across the map.
      const segs = [];
      for (let k = 1; k < ground.length; k++) {
        if (ground[k].distanceTo(ground[k - 1]) > 2) continue;
        segs.push(ground[k - 1], ground[k]);
      }
      this.selGroup.add(new THREE.LineSegments(
        new THREE.BufferGeometry().setFromPoints(segs),
        new THREE.LineBasicMaterial({
          color: PALETTE.selection, transparent: true, opacity: 0.35,
          depthTest: true, toneMapped: false,
        })));
    }

    const tetherGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    this._tether = new THREE.Line(tetherGeo, new THREE.LineDashedMaterial({
      color: PALETTE.selection, dashSize: 0.05, gapSize: 0.035,
      transparent: true, opacity: 0.8, depthTest: true, toneMapped: false,
    }));
    this.selGroup.add(this._tether);
    this._tetherSat = s;
    this._updateTether();
  }

  _updateTether() {
    const s = this._tetherSat;
    if (!this._tether || !s || !s.valid) return;
    const p = this._tether.geometry.attributes.position;
    latLngTo3D(s.lat, s.lng, EARTH_RADIUS + 0.005, this._v);
    p.setXYZ(0, this._v.x, this._v.y, this._v.z);
    p.setXYZ(1, s.pos.x, s.pos.y, s.pos.z);
    p.needsUpdate = true;
    this._tether.computeLineDistances();
  }

  _rebuildPaths() {
    while (this.pathsGroup.children.length) {
      const c = this.pathsGroup.children.pop();
      c.geometry?.dispose(); c.material?.dispose();
      this.pathsGroup.remove(c);
    }
    if (!this.showPaths) return;
    // Cap it. 600 orbit polylines is 108 000 vertices of visual noise that
    // hides the satellites it is meant to explain.
    const subset = this.active.slice(0, 120);
    const now = new Date();
    const byClass = { LEO: [], MEO: [], GEO: [] };
    for (const s of subset) {
      const period = (s.periodMinutes || 95) * 60;
      const steps = 48, pts = [];
      for (let k = 0; k <= steps; k++) {
        const t = new Date(now.getTime() + (period * k / steps) * 1000);
        let pv; try { pv = this.sat.propagate(s.satrec, t); } catch { continue; }
        if (!pv || !pv.position || typeof pv.position === 'boolean') continue;
        const g = this.sat.eciToGeodetic(pv.position, this.sat.gstime(t));
        pts.push(latLngTo3D(g.latitude * RAD2DEG, g.longitude * RAD2DEG, altToRadius(g.height)));
      }
      for (let k = 1; k < pts.length; k++) byClass[s.orbitClass]?.push(pts[k - 1], pts[k]);
    }
    for (const [cls, segs] of Object.entries(byClass)) {
      if (!segs.length) continue;
      this.pathsGroup.add(new THREE.LineSegments(
        new THREE.BufferGeometry().setFromPoints(segs),
        new THREE.LineBasicMaterial({
          color: PALETTE.orbit[cls], transparent: true, opacity: 0.18,
          depthTest: true, toneMapped: false,
        })));
    }
  }

  /* ── Picking ─────────────────────────────────────────────────── */

  pick(ndcX, ndcY, viewportW, viewportH) {
    if (!this.visible) return null;
    let best = null, bestD = PICK_RADIUS_PX * PICK_RADIUS_PX;
    for (const s of this.active) {
      if (!s.valid) continue;
      this._proj.copy(s.pos).project(this.camera);
      if (this._proj.z > 1) continue;
      const dx = (this._proj.x - ndcX) * viewportW * 0.5;
      const dy = (this._proj.y - ndcY) * viewportH * 0.5;
      const d2 = dx * dx + dy * dy;
      if (d2 >= bestD) continue;
      if (this._occluded(s.pos)) continue;
      bestD = d2; best = s;
    }
    return best ? { kind: 'satellite', id: best.id, data: best, distPx: Math.sqrt(bestD) } : null;
  }

  _occluded(pos) {
    const cam = this.camera.position;
    const d = new THREE.Vector3().subVectors(pos, cam);
    const len = d.length(); d.divideScalar(len);
    const b = cam.dot(d);
    const c = cam.lengthSq() - EARTH_RADIUS * EARTH_RADIUS;
    const disc = b * b - c;
    if (disc < 0) return false;
    const tHit = -b - Math.sqrt(disc);
    return tHit > 0.001 && tHit < len - 0.001;
  }

  getSat(id) { return this.sats.find(s => s.id === id); }
}

export { altToRadius, SHELLS };
