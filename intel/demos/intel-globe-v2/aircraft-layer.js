/**
 * aircraft-layer.js — Air picture
 *
 * Replaces the v2 flight rendering wholesale. What was wrong with it:
 *
 *   · 314 separate Mesh objects, each raycast every frame.
 *   · Fixed world-space size — a legible glyph at one zoom, a sub-pixel speck
 *     or an occluding blob at any other.
 *   · AdditiveBlending with depth-testing off: aircraft on the far side of the
 *     planet rendered *through* the Earth, and daylit terrain washed the
 *     glyphs out to nothing.
 *   · Uniform cyan — altitude, the single most operationally important
 *     attribute of an aircraft, was not encoded at all.
 *   · Positions frozen between 5-minute polls, so aircraft teleported. The
 *     update function was an empty loop with a comment explaining that it did
 *     nothing.
 *   · Heading passed to Math.cos()/Math.sin() in degrees. Every aircraft
 *     pointed in an arbitrary direction, and the tooltip's heading readout
 *     was wrong.
 *
 * What this does instead:
 *
 *   · One InstancedMesh. Per-instance colour, orientation and scale.
 *   · Screen-space constant sizing with a hard legibility floor.
 *   · Depth-tested opaque glyphs with a dark keyline, readable over ocean,
 *     ice, desert and city lights alike.
 *   · Altitude-banded colour ramp (see PALETTE.air).
 *   · Great-circle dead reckoning between polls, with the resulting
 *     uncertainty made visible rather than hidden.
 *   · Observed-position history trails.
 *   · Screen-space picking with a pixel-denominated hit radius, so the
 *     click target is the same size everywhere on screen.
 */

import * as THREE from 'three';
import {
  EARTH_RADIUS, DEG2RAD, PALETTE, altitudeColor, latLngTo3D, tangentQuaternion,
  deadReckon, screenScale, registry, selection, feeds, FEED_STATE, fetchWithTimeout,
} from './intel-core.js';

const TRAIL_POINTS = 10;          // observed history samples retained per track
const TRAIL_MIN_KM = 2;           // don't record a sample until it has moved
// Sized against the real constraint: an air picture over the continental US
// puts 300+ symbols in view at once. Large enough to read heading at a
// glance, small enough that dense terminal areas do not fuse into a blob.
const GLYPH_PX = 11;              // target on-screen glyph size
const GLYPH_FLOOR_PX = 7.5;       // never smaller than this — legibility floor
const GLYPH_CEIL_PX = 28;
const PICK_RADIUS_PX = 18;        // generous: a pointing device is not precise
const MAX_EXTRAPOLATION_SEC = 420;// past 7 min a dead-reckoned track is a guess

/** Top-down airliner silhouette in the XY plane: +X nose, +Y wingline. */
function buildGlyphGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0.060, 0);
  s.quadraticCurveTo(0.055, 0.006, 0.040, 0.007);
  s.lineTo(0.020, 0.008);
  s.lineTo(-0.005, 0.060);
  s.lineTo(-0.022, 0.058);
  s.lineTo(-0.018, 0.008);
  s.lineTo(-0.050, 0.006);
  s.lineTo(-0.060, 0.018);
  s.lineTo(-0.070, 0.017);
  s.lineTo(-0.070, 0.003);
  s.lineTo(-0.072, 0.002);
  s.quadraticCurveTo(-0.073, 0, -0.072, -0.002);
  s.lineTo(-0.070, -0.003);
  s.lineTo(-0.070, -0.017);
  s.lineTo(-0.060, -0.018);
  s.lineTo(-0.050, -0.006);
  s.lineTo(-0.018, -0.008);
  s.lineTo(-0.022, -0.058);
  s.lineTo(-0.005, -0.060);
  s.lineTo(0.020, -0.008);
  s.lineTo(0.040, -0.007);
  s.quadraticCurveTo(0.055, -0.006, 0.060, 0);

  const geo = new THREE.ShapeGeometry(s);
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const cx = (bb.min.x + bb.max.x) / 2, cy = (bb.min.y + bb.max.y) / 2;
  const w = bb.max.x - bb.min.x, h = bb.max.y - bb.min.y;
  geo.translate(-cx, -cy, 0);
  geo.scale(1 / Math.max(w, h), 1 / Math.max(w, h), 1); // unit glyph
  return geo;
}

export class AircraftLayer {
  constructor({ scene, camera, renderer, capacity = 3000, endpoint = 'air-traffic.php' }) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.capacity = capacity;
    this.endpoint = endpoint;
    this.visible = true;

    this.tracks = new Map();       // icao24 → track
    this.order = [];               // stable instance ordering
    this.lastFetch = 0;
    this.regions = ['north-america', 'mexico'];

    this._buildMeshes();
    feeds.register('aircraft', {
      label: 'Air Traffic',
      cadenceMs: 5 * 60 * 1000,
      source: 'OpenSky Network · ADS-B state vectors',
    });

    this._m4 = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._v = new THREE.Vector3();
    this._scaleV = new THREE.Vector3();
    this._color = new THREE.Color();
    this._proj = new THREE.Vector3();
  }

  _buildMeshes() {
    this.group = new THREE.Group();
    this.group.name = 'aircraft';
    this.scene.add(this.group);

    const geo = buildGlyphGeometry();

    // Opaque, depth-tested, double-sided. Deliberately NOT additive: additive
    // blending is why v2's aircraft disappeared over daylit land.
    const mat = new THREE.MeshBasicMaterial({
      side: THREE.DoubleSide,
      transparent: false,
      depthTest: true,
      depthWrite: true,
      toneMapped: false,
    });

    this.mesh = new THREE.InstancedMesh(geo, mat, this.capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6;
    this.group.add(this.mesh);

    // Dark keyline drawn a hair behind the glyph. Guarantees contrast against
    // ice sheets, cloud tops and city-light bloom without a shader.
    //
    // Opaque on purpose: three.js draws the whole opaque queue before the
    // whole transparent queue, so a transparent keyline would land on top of
    // the aircraft it is outlining regardless of renderOrder.
    const keyMat = new THREE.MeshBasicMaterial({
      color: 0x05070c, side: THREE.DoubleSide,
      transparent: false,
      depthTest: true, depthWrite: false, toneMapped: false,
    });
    this.keyline = new THREE.InstancedMesh(geo, keyMat, this.capacity);
    this.keyline.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.keyline.count = 0;
    this.keyline.frustumCulled = false;
    this.keyline.renderOrder = 5;
    this.group.add(this.keyline);

    // Observed-position history, one polyline per track packed into one buffer.
    const trailGeo = new THREE.BufferGeometry();
    const segs = this.capacity * (TRAIL_POINTS - 1) * 2;
    this._trailPos = new Float32Array(segs * 3);
    this._trailCol = new Float32Array(segs * 3);
    trailGeo.setAttribute('position', new THREE.BufferAttribute(this._trailPos, 3));
    trailGeo.setAttribute('color', new THREE.BufferAttribute(this._trailCol, 3));
    trailGeo.setDrawRange(0, 0);
    this.trails = new THREE.LineSegments(trailGeo, new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.55,
      depthTest: true, depthWrite: false, toneMapped: false,
    }));
    this.trails.frustumCulled = false;
    this.trails.renderOrder = 4;
    this.group.add(this.trails);

    // Projected-track leader line for the selected aircraft (ATC convention:
    // where this thing will be in 60s / 5min if nothing changes).
    const leadGeo = new THREE.BufferGeometry();
    this._leadPos = new Float32Array(64 * 3);
    leadGeo.setAttribute('position', new THREE.BufferAttribute(this._leadPos, 3));
    leadGeo.setDrawRange(0, 0);
    this.leader = new THREE.Line(leadGeo, new THREE.LineDashedMaterial({
      color: PALETTE.selection, dashSize: 0.06, gapSize: 0.04,
      transparent: true, opacity: 0.9, depthTest: false, toneMapped: false,
    }));
    this.leader.frustumCulled = false;
    this.leader.renderOrder = 20;
    this.group.add(this.leader);
  }

  setVisible(v) {
    this.visible = v;
    this.group.visible = v;
    if (!v) feeds.off('aircraft'); else feeds.attempt('aircraft');
  }

  setRegions(regions) {
    this.regions = regions.length ? regions : ['all'];
    this.fetch();
  }

  /* ── Data ─────────────────────────────────────────────────────── */

  async fetch() {
    feeds.attempt('aircraft');
    try {
      const res = await fetchWithTimeout(this.endpoint + '?regions=' + this.regions.join(','), { timeoutMs: 15000 });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      this._ingest(data.items || []);
      feeds.success('aircraft', this.tracks.size);
    } catch (err) {
      // Do NOT clear the existing picture on a failed poll. Stale-but-labelled
      // beats an empty screen — an operator can reason about old data, but a
      // blank globe reads as "no traffic", which is a lie.
      feeds.failure('aircraft', err);
      console.warn('[aircraft] poll failed:', err);
    }
  }

  _ingest(items) {
    const now = Date.now();
    const seen = new Set();

    for (const s of items) {
      const id = s.icao24;
      if (!id || s.lat == null || s.lng == null) continue;
      seen.add(id);

      let t = this.tracks.get(id);
      if (!t) {
        t = {
          id,
          callsign: (s.callsign || '').trim() || id,
          origin: s.origin || '',
          trail: [],
          firstSeen: now,
        };
        this.tracks.set(id, t);
      }

      // Record the previous OBSERVED fix into the trail before overwriting.
      // Trails show where the aircraft has actually been reported, never where
      // we extrapolated it to.
      if (t.obsLat != null) {
        const last = t.trail[t.trail.length - 1];
        const movedEnough = !last ||
          Math.abs(last.lat - t.obsLat) + Math.abs(last.lng - t.obsLng) > TRAIL_MIN_KM / 111;
        if (movedEnough) {
          t.trail.push({ lat: t.obsLat, lng: t.obsLng, alt: t.alt });
          if (t.trail.length > TRAIL_POINTS) t.trail.shift();
        }
      }

      t.obsLat = s.lat;
      t.obsLng = s.lng;
      t.lat = s.lat;
      t.lng = s.lng;
      t.alt = s.alt || 0;
      t.velocity = s.velocity || 0;           // m/s ground speed
      t.track = s.heading;                    // DEGREES true — see intel-core
      t.verticalRate = s.verticalRate || 0;   // m/s
      t.observedAt = now;
      t.callsign = (s.callsign || '').trim() || t.callsign;
      if (s.origin) t.origin = s.origin;
    }

    // Retire tracks absent for more than two poll cycles.
    for (const [id, t] of this.tracks) {
      if (!seen.has(id) && now - t.observedAt > 11 * 60 * 1000) this.tracks.delete(id);
    }

    this.order = [...this.tracks.keys()];
    this._publishRegistry();
  }

  _publishRegistry() {
    const entities = [];
    for (const t of this.tracks.values()) {
      entities.push({
        id: t.id,
        kind: 'aircraft',
        label: t.callsign,
        sub: (t.origin || 'Unknown origin') + ' · FL' + Math.round((t.alt || 0) * 3.28084 / 100),
        keywords: t.id + ' ' + (t.origin || '') + ' aircraft flight airplane',
        get lat() { return t.lat; },
        get lng() { return t.lng; },
        get alt() { return t.alt; },
        data: t,
      });
    }
    registry.replace('aircraft', entities);
  }

  /* ── Per-frame ───────────────────────────────────────────────── */

  update(now, viewportH) {
    if (!this.visible) { this.mesh.count = 0; this.keyline.count = 0; return; }

    const cam = this.camera;
    let i = 0, trailVert = 0;
    const stale = feeds.feeds.get('aircraft')?.state;
    const feedBad = stale === FEED_STATE.FAILED || stale === FEED_STATE.STALE;

    for (const id of this.order) {
      const t = this.tracks.get(id);
      if (!t || i >= this.capacity) continue;

      // ── Dead reckoning ──
      // Between polls, integrate the last observed velocity vector along a
      // great circle. Confidence decays linearly; beyond MAX_EXTRAPOLATION_SEC
      // we stop moving the symbol entirely rather than fly it somewhere it
      // has no business being.
      const ageSec = (now - t.observedAt) / 1000;
      const dr = Math.min(ageSec, MAX_EXTRAPOLATION_SEC);
      if (t.velocity > 0 && t.track != null && dr > 0) {
        const p = deadReckon(t.obsLat, t.obsLng, t.velocity, t.track, dr);
        t.lat = p.lat; t.lng = p.lng;
      }
      t.altNow = Math.max(0, (t.alt || 0) + (t.verticalRate || 0) * dr);
      t.confidence = Math.max(0, 1 - ageSec / MAX_EXTRAPOLATION_SEC);
      t.extrapolated = ageSec > 15;

      // ── Position ──
      // Altitude exaggerated ×8 so the vertical dimension is actually
      // perceptible; true cruise altitude is 0.2% of Earth's radius and would
      // be invisible at true scale.
      const altKm = Math.min((t.altNow || 0) / 1000, 15);
      const visualAlt = (altKm / 6371) * EARTH_RADIUS * 8 + 0.018;
      latLngTo3D(t.lat, t.lng, EARTH_RADIUS + visualAlt, this._v);
      t.pos = t.pos || new THREE.Vector3();
      t.pos.copy(this._v);

      // ── Orientation (true track, degrees) ──
      tangentQuaternion(t.lat, t.lng, t.track ?? 0, this._q);

      // ── Screen-constant size with legibility floor ──
      const isSel = selection.is('aircraft', t.id);
      const isHov = selection.hovered?.kind === 'aircraft' && selection.hovered.id === t.id;
      const px = isSel ? GLYPH_PX * 1.7 : isHov ? GLYPH_PX * 1.3 : GLYPH_PX;
      const sc = screenScale(this._v, cam, px, viewportH, GLYPH_FLOOR_PX, GLYPH_CEIL_PX);
      this._scaleV.set(sc, sc, sc);

      this._m4.compose(this._v, this._q, this._scaleV);
      this.mesh.setMatrixAt(i, this._m4);

      // Keyline: same transform, 40% larger, sunk slightly toward the planet.
      this._scaleV.multiplyScalar(1.42);
      this._m4.compose(this._v.clone().multiplyScalar(0.9994), this._q, this._scaleV);
      this.keyline.setMatrixAt(i, this._m4);

      // ── Colour: altitude band, desaturated by extrapolation confidence ──
      this._color.setHex(isSel ? PALETTE.selection : altitudeColor(t.altNow));
      if (!isSel && (t.confidence < 1 || feedBad)) {
        // Blend toward slate as the fix ages. A washed-out symbol reads as
        // "I am less sure about this" without needing a legend.
        const k = feedBad ? Math.min(0.55, 0.25 + (1 - t.confidence) * 0.5)
                          : (1 - t.confidence) * 0.45;
        this._color.lerp(new THREE.Color(0x3f4a5c), k);
      }
      this.mesh.setColorAt(i, this._color);

      // ── Trail ──
      if (t.trail.length > 1) {
        for (let k = 0; k < t.trail.length - 1; k++) {
          const a = t.trail[k], b = t.trail[k + 1];
          const fade = (k + 1) / t.trail.length;
          latLngTo3D(a.lat, a.lng, EARTH_RADIUS + ((Math.min((a.alt || 0) / 1000, 15)) / 6371) * EARTH_RADIUS * 8 + 0.018, this._v);
          this._trailPos[trailVert * 3] = this._v.x;
          this._trailPos[trailVert * 3 + 1] = this._v.y;
          this._trailPos[trailVert * 3 + 2] = this._v.z;
          this._writeTrailColor(trailVert, fade * 0.5, isSel);
          trailVert++;
          latLngTo3D(b.lat, b.lng, EARTH_RADIUS + ((Math.min((b.alt || 0) / 1000, 15)) / 6371) * EARTH_RADIUS * 8 + 0.018, this._v);
          this._trailPos[trailVert * 3] = this._v.x;
          this._trailPos[trailVert * 3 + 1] = this._v.y;
          this._trailPos[trailVert * 3 + 2] = this._v.z;
          this._writeTrailColor(trailVert, fade * 0.8, isSel);
          trailVert++;
        }
      }

      t.instanceIndex = i;
      i++;
    }

    this.mesh.count = i;
    this.keyline.count = i;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.keyline.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;

    this.trails.geometry.setDrawRange(0, trailVert);
    this.trails.geometry.attributes.position.needsUpdate = true;
    this.trails.geometry.attributes.color.needsUpdate = true;

    this._updateLeader(now);
  }

  _writeTrailColor(v, intensity, isSel) {
    const c = isSel ? 0x88eeff : PALETTE.air.mid;
    this._color.setHex(c).multiplyScalar(intensity);
    this._trailCol[v * 3] = this._color.r;
    this._trailCol[v * 3 + 1] = this._color.g;
    this._trailCol[v * 3 + 2] = this._color.b;
  }

  /** Projected ground track for the selected aircraft: +1min and +5min. */
  _updateLeader() {
    const sel = selection.selected;
    if (!sel || sel.kind !== 'aircraft') { this.leader.geometry.setDrawRange(0, 0); return; }
    const t = this.tracks.get(sel.id);
    if (!t || !t.velocity || t.track == null) { this.leader.geometry.setDrawRange(0, 0); return; }

    const STEPS = 24, HORIZON = 300; // 5 minutes
    for (let k = 0; k <= STEPS; k++) {
      const dt = (HORIZON * k) / STEPS;
      const p = deadReckon(t.lat, t.lng, t.velocity, t.track, dt);
      const altKm = Math.min(Math.max(0, (t.altNow || 0) + (t.verticalRate || 0) * dt) / 1000, 15);
      latLngTo3D(p.lat, p.lng, EARTH_RADIUS + (altKm / 6371) * EARTH_RADIUS * 8 + 0.018, this._v);
      this._leadPos[k * 3] = this._v.x;
      this._leadPos[k * 3 + 1] = this._v.y;
      this._leadPos[k * 3 + 2] = this._v.z;
    }
    this.leader.geometry.setDrawRange(0, STEPS + 1);
    this.leader.geometry.attributes.position.needsUpdate = true;
    this.leader.computeLineDistances();
  }

  /* ── Picking ─────────────────────────────────────────────────── */

  /**
   * Screen-space nearest-entity pick.
   *
   * Deliberately not a raycast. Raycasting an InstancedMesh gives you a hit
   * only when the pointer is literally over the triangle, which at a 9px
   * glyph means the operator has to hit a 9-pixel target — and at wide zoom,
   * an aircraft that is 4 pixels of glyph plus 30 pixels of surrounding
   * emptiness is effectively unclickable. A pixel-denominated radius makes
   * the hit target the same generous size at every zoom level.
   */
  pick(ndcX, ndcY, viewportW, viewportH, out) {
    if (!this.visible) return null;
    let best = null, bestD = PICK_RADIUS_PX * PICK_RADIUS_PX;
    const camDir = new THREE.Vector3();
    this.camera.getWorldDirection(camDir);

    for (const id of this.order) {
      const t = this.tracks.get(id);
      if (!t || !t.pos) continue;
      this._proj.copy(t.pos).project(this.camera);
      if (this._proj.z > 1) continue;                       // behind camera
      const dx = (this._proj.x - ndcX) * viewportW * 0.5;
      const dy = (this._proj.y - ndcY) * viewportH * 0.5;
      const d2 = dx * dx + dy * dy;
      if (d2 >= bestD) continue;
      // Reject aircraft occluded by the planet.
      if (this._occluded(t.pos)) continue;
      bestD = d2; best = t;
    }
    return best ? { kind: 'aircraft', id: best.id, data: best, distPx: Math.sqrt(bestD) } : null;
  }

  _occluded(pos) {
    // Sphere-line intersection between the camera and the point.
    const cam = this.camera.position;
    const d = new THREE.Vector3().subVectors(pos, cam);
    const len = d.length();
    d.divideScalar(len);
    const oc = cam.clone(); // sphere centred at origin
    const b = oc.dot(d);
    const c = oc.lengthSq() - EARTH_RADIUS * EARTH_RADIUS;
    const disc = b * b - c;
    if (disc < 0) return false;
    const tHit = -b - Math.sqrt(disc);
    return tHit > 0.001 && tHit < len - 0.001;
  }

  getTrack(id) { return this.tracks.get(id); }
  get count() { return this.tracks.size; }
}
