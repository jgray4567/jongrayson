/**
 * intel-core.js — Shared kernel for Intel Layer
 *
 * Doctrine notes (read before changing anything in here):
 *
 *  1. COLOR IS SEMANTIC, NOT DECORATIVE.  Red is reserved exclusively for
 *     threat-to-life. Nothing else in this application may render red. If an
 *     operator sees red, it means people are in danger — not "MEO orbit" or
 *     "high altitude". The v2 palette reused #ff6644 for both GEO satellites
 *     and earthquakes, and #ffaa22 for both MEO and weather. That ambiguity is
 *     removed here.
 *
 *  2. NOTHING RENDERS BELOW A LEGIBILITY FLOOR.  Any entity that is on screen
 *     must be findable. Fixed world-space marker sizes go sub-pixel at zoom-out
 *     and become clutter at zoom-in. Everything uses screenScale().
 *
 *  3. EXTRAPOLATED DATA IS ALWAYS MARKED AS SUCH.  Positions dead-reckoned
 *     between polls are drawn with decaying confidence and labelled. An
 *     operator must never be unable to tell an observation from a guess.
 *
 *  4. A FEED THAT FAILS MUST SAY SO LOUDLY.  Silent staleness is the worst
 *     failure mode in this class of tool — it looks exactly like "nothing is
 *     happening".
 */

import * as THREE from 'three';

export const EARTH_RADIUS = 5;
export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;
export const EARTH_KM = 6371;

/* ══════════════════════════════════════════════════════════════════
   PALETTE — semantic, deconflicted
   ══════════════════════════════════════════════════════════════════ */

export const PALETTE = {
  // Reserved. Threat to life only.
  threat: {
    critical: 0xff2b3d,
    high:     0xff5c3d,
    moderate: 0xff8a3d,
  },
  // Air picture — cool blue→white altitude ramp. Never warm, never red.
  air: {
    ground:  0x2f6fd0,   //     0 – 3 km   (climbout / approach)
    low:     0x2fa8d8,   //   3 – 7 km
    mid:     0x54d6e8,   //   7 – 10 km
    high:    0xa8ecf5,   //  10 – 12 km
    ceiling: 0xf2fdff,   //     > 12 km
  },
  // Orbital assets — violet family. Deliberately unlike anything terrestrial:
  // an object 550 km up must never be confused with an event on the surface.
  orbit: {
    LEO: 0xb98cff,
    MEO: 0x8b6cf0,
    GEO: 0x6d4fd8,
  },
  // Geophysical — amber. Distinct from both threat-red and air-blue.
  seismic: 0xf5b83d,
  // Meteorological — desaturated cyan-white severity ramp.
  weather: {
    Extreme:  0xff8a3d,   // borrows the threat ramp only at Extreme
    Severe:   0xffc95c,
    Moderate: 0x9fd4e8,
    Minor:    0x6f95a8,
  },
  // Reference geometry — must recede. Never competes with signal.
  reference: {
    city:    0x6f8a7a,
    border:  0x2a3a4a,
    graticule: 0x1a2836,
  },
  // UI
  accent:    0xc4d600,
  selection: 0x88eeff,
};

export const hex = (n) => '#' + n.toString(16).padStart(6, '0');

/** Altitude (metres) → air-picture colour. */
export function altitudeColor(altMeters) {
  const km = (altMeters || 0) / 1000;
  if (km < 3)  return PALETTE.air.ground;
  if (km < 7)  return PALETTE.air.low;
  if (km < 10) return PALETTE.air.mid;
  if (km < 12) return PALETTE.air.high;
  return PALETTE.air.ceiling;
}

export const ALTITUDE_BANDS = [
  { label: '< 3 km',    color: PALETTE.air.ground,  note: 'departure / arrival' },
  { label: '3 – 7 km',  color: PALETTE.air.low,     note: 'climb / descent' },
  { label: '7 – 10 km', color: PALETTE.air.mid,     note: 'transition' },
  { label: '10 – 12 km',color: PALETTE.air.high,    note: 'cruise' },
  { label: '> 12 km',   color: PALETTE.air.ceiling, note: 'upper cruise' },
];

/* ══════════════════════════════════════════════════════════════════
   GEODESY
   ══════════════════════════════════════════════════════════════════ */

/** Matches the scene convention established in index.html. */
export function latLngTo3D(lat, lng, r, out) {
  const phi = (90 - lat) * DEG2RAD;
  const theta = (lng + 180) * DEG2RAD;
  const sp = Math.sin(phi), cp = Math.cos(phi);
  const st = Math.sin(theta), ct = Math.cos(theta);
  const v = out || new THREE.Vector3();
  return v.set(-r * sp * ct, r * cp, r * sp * st);
}

/** Inverse of latLngTo3D. */
export function vec3ToLatLng(v) {
  const r = v.length();
  const lat = 90 - Math.acos(v.y / r) * RAD2DEG;
  let lng = Math.atan2(v.z, -v.x) * RAD2DEG - 180;
  while (lng < -180) lng += 360;
  while (lng > 180) lng -= 360;
  return { lat, lng, r };
}

/**
 * Local East-North-Up basis at (lat, lng), matching latLngTo3D.
 *
 * Verified by hand at (0,0): up=(1,0,0), north=(0,1,0), east=(0,0,-1),
 * and east × north = up — a right-handed frame.
 *
 * The v2 code approximated forward as the world vector (cos h, 0, sin h),
 * which is only tangent to the sphere along one meridian. Everywhere else
 * aircraft were canted into or out of the surface.
 */
const _e = new THREE.Vector3(), _n = new THREE.Vector3(), _u = new THREE.Vector3();
export function enuBasis(lat, lng, east = _e, north = _n, up = _u) {
  const phi = (90 - lat) * DEG2RAD;
  const theta = (lng + 180) * DEG2RAD;
  const sp = Math.sin(phi), cp = Math.cos(phi);
  const st = Math.sin(theta), ct = Math.cos(theta);
  up.set(-sp * ct, cp, sp * st);
  north.set(cp * ct, sp, -cp * st);
  east.set(st, 0, ct);
  return { east, north, up };
}

/**
 * Orientation quaternion for a surface-tangent glyph.
 *
 * `headingDeg` is a TRUE TRACK in DEGREES CLOCKWISE FROM NORTH — the
 * convention used by OpenSky (state vector index 10), ADS-B, and every
 * aviation source. It is NOT radians. Passing radians here is the bug that
 * made every aircraft in v2 point somewhere arbitrary.
 *
 * Glyph local axes: +X nose, +Y wingline, +Z away from the surface.
 */
const _fwd = new THREE.Vector3(), _side = new THREE.Vector3(), _m = new THREE.Matrix4();
export function tangentQuaternion(lat, lng, headingDeg, out = new THREE.Quaternion()) {
  const { east, north, up } = enuBasis(lat, lng);
  const h = (headingDeg || 0) * DEG2RAD;
  _fwd.copy(north).multiplyScalar(Math.cos(h)).addScaledVector(east, Math.sin(h)).normalize();
  _side.crossVectors(up, _fwd).normalize();
  _m.makeBasis(_fwd, _side, up);
  return out.setFromRotationMatrix(_m);
}

/**
 * Dead-reckon a position forward along a great circle.
 * groundSpeed m/s, track degrees true, dt seconds.
 */
export function deadReckon(lat, lng, groundSpeedMs, trackDeg, dtSec) {
  if (!groundSpeedMs || dtSec <= 0) return { lat, lng };
  const d = (groundSpeedMs * dtSec) / (EARTH_KM * 1000); // angular distance
  const t = trackDeg * DEG2RAD;
  const p1 = lat * DEG2RAD, l1 = lng * DEG2RAD;
  const sinP1 = Math.sin(p1), cosP1 = Math.cos(p1);
  const sinD = Math.sin(d), cosD = Math.cos(d);
  const p2 = Math.asin(sinP1 * cosD + cosP1 * sinD * Math.cos(t));
  const l2 = l1 + Math.atan2(Math.sin(t) * sinD * cosP1, cosD - sinP1 * Math.sin(p2));
  let lngOut = l2 * RAD2DEG;
  while (lngOut > 180) lngOut -= 360;
  while (lngOut < -180) lngOut += 360;
  return { lat: p2 * RAD2DEG, lng: lngOut };
}

/** Great-circle distance in km. */
export function haversineKm(lat1, lng1, lat2, lng2) {
  const dLat = (lat2 - lat1) * DEG2RAD, dLng = (lng2 - lng1) * DEG2RAD;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEG2RAD) * Math.cos(lat2 * DEG2RAD) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/* ══════════════════════════════════════════════════════════════════
   SCREEN-SPACE SIZING
   ══════════════════════════════════════════════════════════════════ */

/**
 * World-space scale that holds an object at a roughly constant apparent size.
 *
 * `floorPx`/`ceilPx` clamp the result so a marker can never vanish into a
 * sub-pixel speck (the v2 satellite failure — 0.03-radius spheres at 588 count
 * were literally unfindable) nor bloat into an occluding blob at close zoom.
 */
export function screenScale(objectPos, camera, targetPx, viewportH, floorPx = 0, ceilPx = Infinity) {
  const dist = camera.position.distanceTo(objectPos);
  const vFov = camera.fov * DEG2RAD;
  const worldPerPx = (2 * Math.tan(vFov / 2) * dist) / viewportH;
  const px = Math.max(floorPx, Math.min(ceilPx, targetPx));
  return worldPerPx * px;
}

/** True when the point is on the camera-facing hemisphere (not behind Earth). */
export function isFrontFacing(pos, camera, radius = EARTH_RADIUS) {
  const toCam = camera.position.clone().sub(pos);
  const n = pos.clone().normalize();
  // Occluded when the surface normal faces away AND the point is near the shell.
  if (pos.length() > radius * 1.02) return true;
  return n.dot(toCam.normalize()) > -0.05;
}

/* ══════════════════════════════════════════════════════════════════
   ENTITY REGISTRY — the single searchable index of everything on screen
   ══════════════════════════════════════════════════════════════════

   Rule 3 of the brief: if an operator cannot find a thing, the tool has
   failed. Every layer registers its entities here, and the command palette
   searches this and only this. A layer that renders without registering is
   invisible to search — treat that as a defect.
   ══════════════════════════════════════════════════════════════════ */

export class EntityRegistry {
  constructor() {
    this.byKind = new Map();   // kind → Map(id → entity)
    this.listeners = new Set();
  }

  /** entities: [{ id, label, sub, kind, lat, lng, alt, keywords, data }] */
  replace(kind, entities) {
    const m = new Map();
    for (const e of entities) m.set(e.id, e);
    this.byKind.set(kind, m);
    this._emit();
  }

  upsert(kind, entity) {
    if (!this.byKind.has(kind)) this.byKind.set(kind, new Map());
    this.byKind.get(kind).set(entity.id, entity);
  }

  clear(kind) { this.byKind.delete(kind); this._emit(); }

  get(kind, id) { return this.byKind.get(kind)?.get(id); }

  all() {
    const out = [];
    for (const m of this.byKind.values()) out.push(...m.values());
    return out;
  }

  count(kind) { return this.byKind.get(kind)?.size || 0; }

  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  _emit() { for (const fn of this.listeners) fn(this); }

  /**
   * Fuzzy subsequence search across label, sub and keywords.
   * Ranked: exact prefix > word-boundary prefix > contiguous > subsequence.
   * Deliberately forgiving — an operator half-remembering "UAL23" must still
   * land on UAL2371.
   */
  search(query, { limit = 40, kinds = null } = {}) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const results = [];
    for (const [kind, m] of this.byKind) {
      if (kinds && !kinds.includes(kind)) continue;
      for (const e of m.values()) {
        const score = fuzzyScore(q, e);
        if (score > 0) results.push({ entity: e, score });
      }
    }
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit).map(r => r.entity);
  }
}

function fuzzyScore(q, e) {
  const hay = ((e.label || '') + ' ' + (e.sub || '') + ' ' + (e.keywords || '')).toLowerCase();
  const label = (e.label || '').toLowerCase();
  if (label === q) return 1000;
  if (label.startsWith(q)) return 900 - label.length;
  const wordIdx = hay.indexOf(' ' + q);
  if (wordIdx >= 0) return 700 - wordIdx;
  const idx = hay.indexOf(q);
  if (idx >= 0) return 500 - idx;
  // subsequence
  let hi = 0, matched = 0, gaps = 0, lastHit = -1;
  for (let qi = 0; qi < q.length; qi++) {
    const c = q[qi];
    let found = -1;
    while (hi < hay.length) { if (hay[hi] === c) { found = hi; hi++; break; } hi++; }
    if (found < 0) return 0;
    if (lastHit >= 0) gaps += found - lastHit - 1;
    lastHit = found; matched++;
  }
  return matched === q.length ? Math.max(1, 200 - gaps) : 0;
}

/* ══════════════════════════════════════════════════════════════════
   SELECTION BUS
   ══════════════════════════════════════════════════════════════════

   v2 had hover-only tooltips: move the mouse and the information is gone.
   That makes it impossible to read a value and act on it. Selection is
   sticky, survives data refresh (re-resolved by id), and drives the dossier.
   ══════════════════════════════════════════════════════════════════ */

export class SelectionBus {
  constructor() {
    this.selected = null;    // { kind, id }
    this.hovered = null;
    this.tracking = false;   // camera follows selection
    this.listeners = new Set();
  }
  select(kind, id) {
    if (this.selected && this.selected.kind === kind && this.selected.id === id) return;
    this.selected = kind ? { kind, id } : null;
    this._emit('select');
  }
  clear() { this.selected = null; this.tracking = false; this._emit('select'); }
  hover(kind, id) {
    const same = this.hovered && this.hovered.kind === kind && this.hovered.id === id;
    if (same) return;
    this.hovered = kind ? { kind, id } : null;
    this._emit('hover');
  }
  setTracking(v) { this.tracking = !!v; this._emit('track'); }
  is(kind, id) { return !!this.selected && this.selected.kind === kind && this.selected.id === id; }
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  _emit(t) { for (const fn of this.listeners) fn(t, this.selected, this.hovered); }
}

/* ══════════════════════════════════════════════════════════════════
   FEED HEALTH
   ══════════════════════════════════════════════════════════════════

   Every external data source registers here. The monitor knows each feed's
   expected refresh cadence and escalates on its own — a feed does not have to
   report its own failure to be marked failed, because a feed that has hung
   cannot report anything. That is the whole point.
   ══════════════════════════════════════════════════════════════════ */

export const FEED_STATE = {
  LIVE:    'LIVE',
  STALE:   'STALE',
  DEGRADED:'DEGRADED',
  FAILED:  'FAILED',
  OFF:     'OFF',
  LOADING: 'LOADING',
};

export class FeedMonitor {
  constructor() {
    this.feeds = new Map();
    this.listeners = new Set();
    setInterval(() => this._tick(), 1000);
  }

  /**
   * @param key       stable id
   * @param label     operator-facing name
   * @param cadenceMs expected refresh interval
   * @param source    provenance string, shown in the dossier
   */
  register(key, { label, cadenceMs, source }) {
    this.feeds.set(key, {
      key, label, cadenceMs, source,
      state: FEED_STATE.LOADING,
      lastSuccess: 0, lastAttempt: 0,
      count: 0, error: null, consecutiveFailures: 0,
    });
    this._emit();
  }

  attempt(key) { const f = this.feeds.get(key); if (f) { f.lastAttempt = Date.now(); this._emit(); } }

  success(key, count) {
    const f = this.feeds.get(key); if (!f) return;
    f.lastSuccess = Date.now(); f.count = count;
    f.error = null; f.consecutiveFailures = 0;
    f.state = f.pinnedState || FEED_STATE.LIVE;
    this._emit();
  }

  failure(key, err) {
    const f = this.feeds.get(key); if (!f) return;
    f.error = String(err && err.message || err);
    f.consecutiveFailures++;
    // One miss is a blip; two is a fault. But if we have never succeeded,
    // there is nothing on screen at all — fail immediately and loudly.
    f.state = (f.consecutiveFailures >= 2 || !f.lastSuccess)
      ? FEED_STATE.FAILED : FEED_STATE.DEGRADED;
    this._emit();
  }

  off(key) { const f = this.feeds.get(key); if (f) { f.state = FEED_STATE.OFF; this._emit(); } }

  /**
   * Pin a feed to a state that freshness alone must not override.
   *
   * Recency is not trustworthiness. A source can be answering promptly and
   * still be unusable — the maritime endpoint returns well-formed, current
   * data that is entirely synthetic. Without pinning, _tick() sees a recent
   * lastSuccess and promotes it straight back to LIVE, quietly undoing the
   * one label that tells the operator not to trust it.
   */
  pin(key, state, source) {
    const f = this.feeds.get(key);
    if (!f) return;
    f.pinnedState = state;
    f.state = state;
    if (source) f.source = source;
    this._emit();
  }
  unpin(key) {
    const f = this.feeds.get(key);
    if (f) { f.pinnedState = null; this._emit(); }
  }

  _tick() {
    let changed = false;
    const now = Date.now();
    for (const f of this.feeds.values()) {
      if (f.pinnedState) { if (f.state !== f.pinnedState) { f.state = f.pinnedState; changed = true; } continue; }
      if (f.state === FEED_STATE.OFF || f.state === FEED_STATE.FAILED) continue;
      if (!f.lastSuccess) continue;
      const age = now - f.lastSuccess;
      // Grace of 1.5 cadences before calling it stale; 3 before failed.
      const next = age > f.cadenceMs * 3 ? FEED_STATE.FAILED
                 : age > f.cadenceMs * 1.5 ? FEED_STATE.STALE
                 : FEED_STATE.LIVE;
      if (next !== f.state) { f.state = next; changed = true; }
    }
    if (changed) this._emit();
    // Age readouts tick every second regardless of state change.
    for (const fn of this.listeners) fn(this, true);
  }

  /** Worst state across all feeds — drives the global posture indicator. */
  worst() {
    const rank = { LIVE: 0, LOADING: 1, OFF: 0, STALE: 2, DEGRADED: 3, FAILED: 4 };
    let worst = FEED_STATE.LIVE;
    for (const f of this.feeds.values()) if (rank[f.state] > rank[worst]) worst = f.state;
    return worst;
  }

  ageOf(key) {
    const f = this.feeds.get(key);
    if (!f || !f.lastSuccess) return null;
    return Date.now() - f.lastSuccess;
  }

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  _emit() { for (const fn of this.listeners) fn(this, false); }
}

/** "12s" / "4m 20s" / "1h 03m" — compact enough for a status chip. */
export function formatAge(ms) {
  if (ms == null) return '—';
  const s = Math.floor(ms / 1000);
  if (s < 60) return s + 's';
  const m = Math.floor(s / 60);
  if (m < 60) return m + 'm ' + String(s % 60).padStart(2, '0') + 's';
  const h = Math.floor(m / 60);
  return h + 'h ' + String(m % 60).padStart(2, '0') + 'm';
}

export function formatCoord(lat, lng) {
  const ns = lat >= 0 ? 'N' : 'S', ew = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(3)}°${ns} ${Math.abs(lng).toFixed(3)}°${ew}`;
}

/* ══════════════════════════════════════════════════════════════════
   SHARED STATE SINGLETONS
   ══════════════════════════════════════════════════════════════════ */

export const registry = new EntityRegistry();
export const selection = new SelectionBus();
export const feeds = new FeedMonitor();
