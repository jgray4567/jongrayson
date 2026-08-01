/**
 * mission-ui.js — Operator surface
 *
 * Built against one rule from the brief: if there is something an operator
 * cannot find, that is a failure of the tool, not of the operator.
 *
 * v2 had no search of any kind. The only way to locate a specific aircraft
 * among 314, or a specific satellite among 588, was to rotate the globe and
 * hover over things one at a time until the right tooltip appeared — and the
 * tooltip vanished the moment the pointer moved, so you could not read a
 * value and act on it. That is not a findability problem at the margins; it
 * means the data on screen was, in practice, unreachable.
 *
 * This module provides:
 *   · Command palette (⌘K / Ctrl-K / "/") — fuzzy search over every
 *     registered entity plus every command, keyboard-driven end to end.
 *   · Dossier — a pinned, persistent detail panel with explicit provenance,
 *     data age, and extrapolation state.
 *   · Feed health strip — per-source state and age, always visible, with a
 *     global posture indicator that escalates on its own.
 *   · Legend — the colour contract, stated rather than assumed.
 *   · Keyboard map (?) — every action reachable without a pointer.
 */

import {
  registry, selection, feeds, FEED_STATE, formatAge, formatCoord,
  PALETTE, hex, ALTITUDE_BANDS,
} from './intel-core.js';

/* ══════════════════════════════════════════════════════════════
   AIRLINE LOGOS
   ══════════════════════════════════════════════════════════════

   Backed by the existing /intel/api/airline-logos.php, which maps an ICAO
   callsign prefix (UAL, FDX, BAW…) to an IATA code and returns either a
   base64 data URI — proxied server-side specifically so adblockers that
   blanket-block pics.avs.io don't punch holes in the panel — or a path to a
   local SVG.

   Three things this has to get right:

   · The endpoint is shared with /intel/shell.js, which sits at /intel/ and so
     resolves the returned relative path correctly. This page is two levels
     deeper, so the path is re-based HERE rather than by changing the shared
     API and breaking the other caller.
   · The API advertises nine local-SVG codes but only three files exist
     (5X, FX, MZ). The rest 404, so a load failure has to fall back cleanly.
   · A logo is decoration. It must never delay, blank, or break the panel —
     the callsign and the operator name are the information, and they render
     immediately regardless of whether a logo ever arrives.
   ══════════════════════════════════════════════════════════════ */

const logoCache = new Map();     // ICAO prefix → url | null (null = known-none)
const logoPending = new Map();

function reboneLogoUrl(raw) {
  if (!raw) return null;
  if (/^(data:|https?:|\/)/i.test(raw)) return raw;
  // Relative paths from the API are relative to /intel/; we are at
  // /intel/demos/intel-globe-v2/.
  return '../../' + raw.replace(/^\.?\//, '');
}

export function airlineLogo(callsign) {
  const prefix = String(callsign || '').slice(0, 3).toUpperCase();
  if (!/^[A-Z]{3}$/.test(prefix)) return Promise.resolve(null);
  if (logoCache.has(prefix)) return Promise.resolve(logoCache.get(prefix));
  if (logoPending.has(prefix)) return logoPending.get(prefix);

  // Request well above the CSS display size so the bitmap stays crisp when
  // scaled down and on high-DPI displays. The endpoint caches for 24h, so the
  // extra bytes are paid once per operator.
  const p = fetch('../../api/airline-logos.php?callsign=' +
                  encodeURIComponent(callsign) + '&w=240&h=88')
    .then(r => (r.ok ? r.json() : null))
    .then(d => {
      const url = reboneLogoUrl(d && d.logoUrl);
      logoCache.set(prefix, url || null);
      logoPending.delete(prefix);
      return url || null;
    })
    .catch(() => { logoCache.set(prefix, null); logoPending.delete(prefix); return null; });

  logoPending.set(prefix, p);
  return p;
}

const KIND_META = {
  aircraft:  { icon: '✈', label: 'Aircraft',   color: () => hex(PALETTE.air.mid) },
  satellite: { icon: '◇', label: 'Satellite',  color: () => hex(PALETTE.orbit.LEO) },
  city:      { icon: '◎', label: 'City',       color: () => hex(PALETTE.reference.city) },
  hotspot:   { icon: '▲', label: 'Hotspot',    color: () => hex(PALETTE.threat.critical) },
  quake:     { icon: '◉', label: 'Seismic',    color: () => hex(PALETTE.seismic) },
  weather:   { icon: '◈', label: 'Weather',    color: () => hex(PALETTE.weather.Severe) },
  camera:    { icon: '▣', label: 'Camera',     color: () => hex(PALETTE.accent) },
  command:   { icon: '⌘', label: 'Command',    color: () => hex(PALETTE.accent) },
};

export class MissionUI {
  constructor({ onNavigate, onCommand, commands = [], getContext }) {
    this.onNavigate = onNavigate;         // (entity) => void — fly camera to it
    this.onCommand = onCommand;           // (command) => void
    this.commands = commands;             // [{ id, label, sub, keys, run }]
    this.getContext = getContext || (() => ({}));

    this.paletteOpen = false;
    this.paletteIndex = 0;
    this.paletteResults = [];

    this._buildPalette();
    this._buildDossier();
    this._buildHealth();
    this._buildLegend();
    this._buildKeymap();
    this._bindKeys();

    selection.on((type) => {
      if (type === 'select') this.renderDossier();
    });

    // The right rail hosts regions, the dossier and the legend. Only one of
    // them may be visible; these classes drive that in CSS.
    const syncContext = () => {
      document.body.classList.toggle('ctx-dossier', !!selection.selected);
      document.body.classList.toggle('ctx-legend',
        this.legendEl.classList.contains('open'));
    };
    selection.on(syncContext);
    this._syncContext = syncContext;
    feeds.on(() => this.renderHealth());

    // The dossier must reflect changing values (position, altitude, data age)
    // without the operator having to re-click. 4 Hz is enough to read.
    setInterval(() => { if (selection.selected) this.renderDossier(true); }, 250);
  }

  /* ══ Command palette ═══════════════════════════════════════════ */

  _buildPalette() {
    const el = document.createElement('div');
    el.id = 'cmd-palette';
    el.innerHTML = `
      <div class="cp-shell">
        <div class="cp-input-row">
          <span class="cp-prompt">›</span>
          <input id="cp-input" type="text" autocomplete="off" spellcheck="false"
                 placeholder="Search aircraft, satellites, cities, events — or type a command">
          <kbd class="cp-esc">ESC</kbd>
        </div>
        <div class="cp-results" id="cp-results"></div>
        <div class="cp-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> go to</span>
          <span><kbd>⇥</kbd> filter type</span>
          <span class="cp-foot-right" id="cp-scope">all sources</span>
        </div>
      </div>`;
    document.body.appendChild(el);
    this.paletteEl = el;
    this.inputEl = el.querySelector('#cp-input');
    this.resultsEl = el.querySelector('#cp-results');

    this.inputEl.addEventListener('input', () => this.runSearch());
    this.inputEl.addEventListener('keydown', (e) => this._paletteKey(e));
    el.addEventListener('mousedown', (e) => { if (e.target === el) this.closePalette(); });
  }

  openPalette(prefill = '') {
    this.paletteOpen = true;
    this.paletteEl.classList.add('open');
    this.inputEl.value = prefill;
    this.inputEl.focus();
    this.inputEl.select();
    this.runSearch();
  }

  closePalette() {
    this.paletteOpen = false;
    this.paletteEl.classList.remove('open');
    this.inputEl.blur();
  }

  runSearch() {
    const q = this.inputEl.value.trim();
    const results = [];

    // Commands rank first on an empty or short query — with nothing typed the
    // palette should teach the operator what the tool can do, not sit blank.
    const cmdMatches = this.commands.filter(c =>
      !q || (c.label + ' ' + (c.sub || '') + ' ' + (c.keywords || ''))
        .toLowerCase().includes(q.toLowerCase()));
    for (const c of cmdMatches.slice(0, q ? 4 : 8)) {
      results.push({ kind: 'command', label: c.label, sub: c.sub, keys: c.keys, command: c });
    }

    if (q) {
      const ents = registry.search(q, { limit: 40 });
      for (const e of ents) results.push(e);
    }

    this.paletteResults = results;
    this.paletteIndex = 0;
    this._renderResults();
    document.getElementById('cp-scope').textContent =
      q ? `${results.length} match${results.length === 1 ? '' : 'es'} · ${registry.all().length} entities indexed`
        : `${registry.all().length} entities indexed`;
  }

  _renderResults() {
    const rows = this.paletteResults.map((r, i) => {
      const meta = KIND_META[r.kind] || KIND_META.command;
      const keys = r.keys ? `<span class="cp-keys">${r.keys.map(k => `<kbd>${k}</kbd>`).join('')}</span>` : '';
      const coord = (r.lat != null && r.lng != null)
        ? `<span class="cp-coord">${formatCoord(r.lat, r.lng)}</span>` : '';
      return `<div class="cp-row${i === this.paletteIndex ? ' active' : ''}" data-i="${i}">
        <span class="cp-icon" style="color:${meta.color()}">${meta.icon}</span>
        <span class="cp-label">${escapeHtml(r.label || '')}</span>
        <span class="cp-sub">${escapeHtml(r.sub || meta.label)}</span>
        ${coord}${keys}
      </div>`;
    }).join('');
    this.resultsEl.innerHTML = rows || `<div class="cp-empty">No match. Search is over every live entity — if it is on the globe it is in here.</div>`;
    this.resultsEl.querySelectorAll('.cp-row').forEach(row => {
      row.addEventListener('mouseenter', () => {
        this.paletteIndex = +row.dataset.i;
        this.resultsEl.querySelectorAll('.cp-row').forEach(r => r.classList.remove('active'));
        row.classList.add('active');
      });
      row.addEventListener('click', () => { this.paletteIndex = +row.dataset.i; this._activate(); });
    });
  }

  _paletteKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); this.closePalette(); return; }
    if (e.key === 'ArrowDown' || (e.key === 'n' && e.ctrlKey)) {
      e.preventDefault();
      this.paletteIndex = Math.min(this.paletteResults.length - 1, this.paletteIndex + 1);
      this._renderResults(); this._scrollActive();
    } else if (e.key === 'ArrowUp' || (e.key === 'p' && e.ctrlKey)) {
      e.preventDefault();
      this.paletteIndex = Math.max(0, this.paletteIndex - 1);
      this._renderResults(); this._scrollActive();
    } else if (e.key === 'Enter') {
      e.preventDefault(); this._activate();
    }
  }

  _scrollActive() {
    const el = this.resultsEl.querySelector('.cp-row.active');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }

  _activate() {
    const r = this.paletteResults[this.paletteIndex];
    if (!r) return;
    this.closePalette();
    if (r.kind === 'command') { r.command.run(); return; }
    selection.select(r.kind, r.id);
    this.onNavigate?.(r);
  }

  /* ══ Dossier ═══════════════════════════════════════════════════ */

  _buildDossier() {
    const el = document.createElement('div');
    el.id = 'dossier';
    el.className = 'glass';
    el.innerHTML = `
      <div class="ds-head">
        <div class="ds-kind" id="ds-kind">—</div>
        <div class="ds-actions">
          <button class="ds-btn" id="ds-track" title="Lock camera to this entity (T)">TRACK</button>
          <button class="ds-btn ds-x" id="ds-close" title="Deselect (Esc)">✕</button>
        </div>
      </div>
      <div class="ds-title" id="ds-title">—</div>
      <div class="ds-sub" id="ds-sub"></div>
      <div class="ds-ident" id="ds-ident"></div>
      <div class="ds-banner" id="ds-banner"></div>
      <div class="ds-body" id="ds-body"></div>
      <div class="ds-prov" id="ds-prov"></div>`;
    document.body.appendChild(el);
    this.dossierEl = el;
    el.querySelector('#ds-close').addEventListener('click', () => selection.clear());
    el.querySelector('#ds-track').addEventListener('click', () => {
      selection.setTracking(!selection.tracking);
      this.renderDossier();
    });
  }

  renderDossier(soft = false) {
    const sel = selection.selected;
    if (!sel) { this.dossierEl.classList.remove('open'); return; }
    const entity = registry.get(sel.kind, sel.id);
    if (!entity) {
      // The entity left the picture between refreshes. Say so explicitly —
      // silently closing the panel looks like the operator mis-clicked.
      this.dossierEl.classList.add('open');
      document.getElementById('ds-kind').textContent = (KIND_META[sel.kind]?.label || sel.kind).toUpperCase();
      document.getElementById('ds-title').textContent = sel.id;
      document.getElementById('ds-sub').textContent = '';
      document.getElementById('ds-banner').innerHTML =
        `<div class="ds-warn">TRACK LOST — this entity is no longer reported by its source.</div>`;
      document.getElementById('ds-body').innerHTML = '';
      document.getElementById('ds-prov').textContent = '';
      return;
    }

    this.dossierEl.classList.add('open');
    const meta = KIND_META[sel.kind] || {};
    const kindEl = document.getElementById('ds-kind');
    kindEl.textContent = (meta.label || sel.kind).toUpperCase();
    kindEl.style.color = meta.color ? meta.color() : '';
    document.getElementById('ds-title').textContent = entity.label || '—';
    document.getElementById('ds-sub').textContent = entity.sub || '';

    const trackBtn = document.getElementById('ds-track');
    trackBtn.classList.toggle('on', selection.tracking);
    trackBtn.textContent = selection.tracking ? 'TRACKING' : 'TRACK';

    this._renderIdent(sel, entity);

    const { rows, banner, provenance } = this._dossierContent(sel.kind, entity);
    document.getElementById('ds-banner').innerHTML = banner || '';
    document.getElementById('ds-body').innerHTML = rows.map(r =>
      r.divider
        ? `<div class="ds-div">${escapeHtml(r.divider)}</div>`
        : `<div class="ds-row"><span class="ds-k">${escapeHtml(r.k)}</span><span class="ds-v" style="${r.style || ''}">${r.html || escapeHtml(String(r.v ?? '—'))}</span></div>`
    ).join('');
    document.getElementById('ds-prov').innerHTML = provenance || '';
  }

  /**
   * Operator identity block — logo plus airline name, above the data.
   *
   * Rebuilt only when the SELECTED ENTITY CHANGES, never on the 250 ms value
   * refresh. renderDossier() rewrites its body four times a second to keep
   * position and data-age live; re-emitting an <img> at that rate would make
   * the logo strobe and re-request on every tick.
   */
  _renderIdent(sel, entity) {
    const host = document.getElementById('ds-ident');
    if (!host) return;
    const key = sel.kind + '|' + sel.id;
    if (this._identFor === key) return;
    this._identFor = key;

    if (sel.kind !== 'aircraft') { host.className = 'ds-ident'; host.innerHTML = ''; return; }

    const t = entity.data;
    const name = (typeof window.getAirlineInfo === 'function'
      ? window.getAirlineInfo(t.callsign)
      : null) || {};
    host.className = 'ds-ident';
    host.innerHTML = `
      <div class="ds-logo-slot" id="ds-logo-slot">
        <span class="ds-logo-chip" style="background:${name.color || '#3f4a5c'}">${escapeHtml(name.code || (t.callsign || '').slice(0, 2))}</span>
      </div>
      <div class="ds-operator">
        <div class="ds-op-name">${escapeHtml(name.name || 'Unknown operator')}</div>
        <div class="ds-op-reg">${escapeHtml(t.origin || '')}</div>
      </div>`;
    host.classList.add('shown');

    airlineLogo(t.callsign).then(url => {
      // The operator may have changed selection while this was in flight.
      if (this._identFor !== key || !url) return;
      const slot = document.getElementById('ds-logo-slot');
      if (!slot) return;
      const img = new Image();
      img.alt = name.name || 'Operator logo';
      img.className = 'ds-logo';
      // Swap only once the bitmap has actually decoded, so a 404 on one of
      // the six advertised-but-absent local SVGs leaves the coloured chip
      // in place instead of a broken-image glyph.
      img.onload = () => {
        if (this._identFor !== key) return;
        slot.innerHTML = '';
        slot.appendChild(img);
      };
      img.onerror = () => {};
      img.src = url;
    });
  }

  _dossierContent(kind, e) {
    const rows = [];
    let banner = '', provenance = '';

    if (kind === 'aircraft') {
      const t = e.data;
      const ageSec = (Date.now() - t.observedAt) / 1000;
      const fl = Math.round((t.altNow || t.alt || 0) * 3.28084 / 100);
      const vs = Math.round((t.verticalRate || 0) * 196.85);   // m/s → ft/min
      const vsState = vs > 150 ? 'CLIMB' : vs < -150 ? 'DESCENT' : 'LEVEL';

      // The single most important line in this panel. An operator acting on a
      // position must know whether that position was observed or computed.
      if (t.extrapolated) {
        banner = `<div class="ds-extrap">
          <span class="ds-extrap-dot"></span>
          DEAD-RECKONED POSITION — last observed fix ${formatAge(Date.now() - t.observedAt)} ago.
          Displayed position is computed from last known track and ground speed,
          not reported. Confidence ${Math.round(t.confidence * 100)}%.
        </div>`;
      }

      rows.push({ divider: 'Position' });
      rows.push({ k: 'Coordinates', v: formatCoord(t.lat, t.lng) });
      rows.push({ k: 'Flight level', v: 'FL' + String(fl).padStart(3, '0') + '  (' + ((t.altNow || 0) / 1000).toFixed(2) + ' km)' });
      rows.push({ k: 'Vertical', html: `<span style="color:${vs > 150 ? hex(PALETTE.air.ceiling) : vs < -150 ? hex(PALETTE.air.low) : '#8a97a8'}">${vsState}</span> ${vs ? (vs > 0 ? '+' : '') + vs + ' ft/min' : ''}` });
      rows.push({ divider: 'Vector' });
      rows.push({ k: 'Ground speed', v: t.velocity ? Math.round(t.velocity * 1.94384) + ' kt  (' + Math.round(t.velocity * 3.6) + ' km/h)' : '—' });
      rows.push({ k: 'True track', v: t.track != null ? String(Math.round(t.track)).padStart(3, '0') + '°T' : '—' });
      rows.push({ divider: 'Identity' });
      rows.push({ k: 'Callsign', v: t.callsign });
      rows.push({ k: 'ICAO 24-bit', v: t.id.toUpperCase() });
      rows.push({ k: 'Registered', v: t.origin || 'Unknown' });
      if (t.squawk) rows.push({ k: 'Squawk', v: t.squawk });
      rows.push({ divider: 'Data quality' });
      rows.push({
        k: 'Last observed', html: `<span style="color:${ageSec > 300 ? hex(PALETTE.threat.moderate) : ageSec > 60 ? '#d8c85c' : hex(PALETTE.air.mid)}">${formatAge(Date.now() - t.observedAt)} ago</span>`
      });
      rows.push({ k: 'Tracked for', v: formatAge(Date.now() - t.firstSeen) });
      rows.push({ k: 'Observed fixes', v: t.trail.length + 1 });
      provenance = this._provenance('aircraft');

    } else if (kind === 'satellite') {
      const s = e.data;
      rows.push({ divider: 'Sub-satellite point' });
      rows.push({ k: 'Currently over', v: s.lat != null ? formatCoord(s.lat, s.lng) : '—' });
      rows.push({ k: 'Altitude', v: s.heightKm ? Math.round(s.heightKm).toLocaleString() + ' km' : Math.round(s.altitudeKm).toLocaleString() + ' km' });
      rows.push({ divider: 'Orbit' });
      rows.push({
        k: 'Regime', html: `<span style="color:${hex(PALETTE.orbit[s.orbitClass] || PALETTE.orbit.LEO)}">${s.orbitClass}</span>`
      });
      rows.push({ k: 'Period', v: s.periodMinutes ? s.periodMinutes.toFixed(1) + ' min' : '—' });
      rows.push({ k: 'Inclination', v: s.inclination != null ? s.inclination.toFixed(2) + '°' : '—' });
      rows.push({ k: 'Orbital velocity', v: s.velocityKms ? s.velocityKms.toFixed(2) + ' km/s' : '—' });
      rows.push({ divider: 'Identity' });
      rows.push({ k: 'Designation', v: s.name });
      rows.push({ k: 'NORAD ID', v: s.noradId || '—' });
      rows.push({ k: 'Constellation', v: s.network });
      rows.push({ divider: 'Element set' });
      rows.push({ k: 'Propagator', v: 'SGP4' });
      rows.push({ html: `<span class="ds-tle">${escapeHtml(s.tle1)}<br>${escapeHtml(s.tle2)}</span>`, k: 'TLE' });
      banner = `<div class="ds-note">Orbital altitude on the globe is <b>logarithmically compressed</b> so LEO through GEO fit one view. The drawn shell rings mark the true regime boundaries. Sub-satellite point and ground track are geometrically exact.</div>`;
      provenance = this._provenance('satellites');

    } else if (kind === 'quake') {
      const q = e.data;
      rows.push({ divider: 'Event' });
      rows.push({ k: 'Magnitude', html: `<span style="color:${hex(PALETTE.seismic)};font-size:15px;font-weight:600">M${(q.mag || 0).toFixed(1)}</span>` });
      rows.push({ k: 'Depth', v: q.depth != null ? q.depth.toFixed(1) + ' km' : '—' });
      rows.push({ k: 'Epicentre', v: formatCoord(e.lat, e.lng) });
      rows.push({ k: 'Origin time', v: q.time ? new Date(q.time).toISOString().replace('T', ' ').slice(0, 19) + 'Z' : '—' });
      rows.push({ k: 'Elapsed', v: q.time ? formatAge(Date.now() - q.time) : '—' });
      if (q.place) rows.push({ k: 'Region', v: q.place });
      provenance = this._provenance('earthquakes');

    } else if (kind === 'weather') {
      const a = e.data;
      rows.push({ divider: 'Alert' });
      rows.push({ k: 'Event', v: a.event });
      rows.push({
        k: 'Severity', html: `<span style="color:${hex(PALETTE.weather[a.severity] || PALETTE.weather.Minor)}">${a.severity || '—'}</span>`
      });
      if (a.urgency) rows.push({ k: 'Urgency', v: a.urgency });
      if (a.certainty) rows.push({ k: 'Certainty', v: a.certainty });
      rows.push({ k: 'Area', v: a.areaDesc || '—' });
      provenance = this._provenance('weather');

    } else if (kind === 'hotspot') {
      const h = e.data;
      const sevLabel = ['LOW', 'MODERATE', 'HIGH'][h.sev - 1] || 'UNKNOWN';
      const sevColor = [PALETTE.threat.moderate, PALETTE.threat.high, PALETTE.threat.critical][h.sev - 1];
      rows.push({ k: 'Assessed severity', html: `<span style="color:${hex(sevColor)}">${sevLabel}</span>` });
      rows.push({ k: 'Centroid', v: formatCoord(e.lat, e.lng) });
      banner = `<div class="ds-note">Static reference marker. This is an editorial annotation of a known area of concern — <b>not a live feed</b> and not a real-time assessment.</div>`;
      provenance = `<span class="ds-prov-src">Curated reference set · not machine-generated</span>`;

    } else if (kind === 'city') {
      const c = e.data;
      rows.push({ k: 'Population', v: (c.pop || 0).toLocaleString() });
      rows.push({ k: 'Country', v: c.country });
      rows.push({ k: 'Coordinates', v: formatCoord(e.lat, e.lng) });
      provenance = `<span class="ds-prov-src">Static reference geography</span>`;
    }

    return { rows, banner, provenance };
  }

  _provenance(feedKey) {
    const f = feeds.feeds.get(feedKey);
    if (!f) return '';
    const age = feeds.ageOf(feedKey);
    return `<span class="ds-prov-state ds-${f.state}">${f.state}</span>
            <span class="ds-prov-src">${escapeHtml(f.source)}</span>
            <span class="ds-prov-age">polled ${formatAge(age)} ago · every ${Math.round(f.cadenceMs / 60000)} min</span>`;
  }

  /* ══ Feed health ═══════════════════════════════════════════════ */

  _buildHealth() {
    const el = document.createElement('div');
    el.id = 'feed-health';
    el.className = 'glass';
    el.innerHTML = `
      <div class="fh-head">
        <span class="fh-title">Source Integrity</span>
        <span class="fh-posture" id="fh-posture">—</span>
      </div>
      <div class="fh-list" id="fh-list"></div>`;
    document.body.appendChild(el);
    this.healthEl = el;
    this.renderHealth();

    // Opened from the posture chip in the top bar, or with H.
    document.getElementById('posture-mini')
      ?.addEventListener('click', (e) => { e.stopPropagation(); this.toggleHealth(); });
    document.addEventListener('mousedown', (e) => {
      if (!el.classList.contains('open')) return;
      if (el.contains(e.target) || e.target.id === 'posture-mini') return;
      this.toggleHealth(false);
    });

    // The popover is absolutely positioned from a measured anchor, so a
    // viewport change invalidates it — without this it stays pinned to
    // coordinates that may now be off-screen.
    window.addEventListener('resize', () => {
      if (el.classList.contains('open')) this._anchorHealth();
    });
  }

  toggleHealth(force) {
    const on = force != null ? force : !this.healthEl.classList.contains('open');
    this.healthEl.classList.toggle('open', on);
    if (!on) return;
    this._anchorHealth();
    this.renderHealth();
  }

  _anchorHealth() {
    const chip = document.getElementById('posture-mini');
    const r = chip ? chip.getBoundingClientRect() : { left: 16, bottom: 56, width: 80 };
    const w = this.healthEl.offsetWidth || 288;
    let left = r.left + r.width / 2 - w / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    this.healthEl.style.left = left + 'px';
    this.healthEl.style.top = (r.bottom + 8) + 'px';
  }

  renderHealth() {
    const list = document.getElementById('fh-list');
    if (!list) return;
    const rows = [];
    for (const f of feeds.feeds.values()) {
      const age = feeds.ageOf(f.key);
      rows.push(`<div class="fh-row fh-${f.state}" title="${escapeHtml(f.source)}${f.error ? ' — ' + escapeHtml(f.error) : ''}">
        <span class="fh-dot"></span>
        <span class="fh-label">${escapeHtml(f.label)}</span>
        <span class="fh-count">${f.state === FEED_STATE.OFF ? '—' : f.count}</span>
        <span class="fh-age">${f.state === FEED_STATE.OFF ? 'off' : formatAge(age)}</span>
        <span class="fh-state">${f.state}</span>
      </div>`);
    }
    list.innerHTML = rows.join('');

    const worst = feeds.worst();
    const posture = document.getElementById('fh-posture');
    if (posture) {
      const text = { LIVE: 'ALL SOURCES NOMINAL', LOADING: 'ACQUIRING', STALE: 'DEGRADED — STALE DATA', DEGRADED: 'DEGRADED', FAILED: 'SOURCE FAILURE' }[worst];
      posture.textContent = text;
      posture.className = 'fh-posture fh-' + worst;
    }
    // Mirror into the top bar so posture is visible even with the panel closed.
    const mini = document.getElementById('posture-mini');
    if (mini) {
      mini.className = 'posture-mini fh-' + worst;
      mini.textContent = { LIVE: 'NOMINAL', LOADING: 'ACQUIRING', STALE: 'STALE', DEGRADED: 'DEGRADED', FAILED: 'FAILURE' }[worst];
    }
  }

  /* ══ Legend ════════════════════════════════════════════════════ */

  _buildLegend() {
    const el = document.createElement('div');
    el.id = 'legend';
    el.className = 'glass';
    el.innerHTML = `
      <div class="lg-head"><span>Symbology</span><button class="lg-x" id="lg-close">✕</button></div>

      <div class="lg-rule">Red is reserved for threat to life. Nothing else on this globe renders red.</div>

      <div class="lg-group">Aircraft — altitude band</div>
      ${ALTITUDE_BANDS.map(b => `<div class="lg-row"><span class="lg-sw" style="background:${hex(b.color)}"></span><span class="lg-l">${b.label}</span><span class="lg-n">${b.note}</span></div>`).join('')}
      <div class="lg-row lg-faint"><span class="lg-sw lg-sw-faded"></span><span class="lg-l">Desaturated</span><span class="lg-n">position dead-reckoned, not observed</span></div>

      <div class="lg-group">Orbital regime</div>
      <div class="lg-row"><span class="lg-sw" style="background:${hex(PALETTE.orbit.LEO)}"></span><span class="lg-l">LEO</span><span class="lg-n">160 – 2 000 km</span></div>
      <div class="lg-row"><span class="lg-sw" style="background:${hex(PALETTE.orbit.MEO)}"></span><span class="lg-l">MEO</span><span class="lg-n">2 000 – 35 000 km</span></div>
      <div class="lg-row"><span class="lg-sw" style="background:${hex(PALETTE.orbit.GEO)}"></span><span class="lg-l">GEO</span><span class="lg-n">geostationary</span></div>

      <div class="lg-group">Threat &amp; hazard</div>
      <div class="lg-row"><span class="lg-sw" style="background:${hex(PALETTE.threat.critical)}"></span><span class="lg-l">Critical</span><span class="lg-n">active armed conflict</span></div>
      <div class="lg-row"><span class="lg-sw" style="background:${hex(PALETTE.threat.high)}"></span><span class="lg-l">High</span><span class="lg-n">elevated risk</span></div>
      <div class="lg-row"><span class="lg-sw" style="background:${hex(PALETTE.seismic)}"></span><span class="lg-l">Seismic</span><span class="lg-n">USGS event, radius ∝ magnitude</span></div>
      <div class="lg-row"><span class="lg-sw" style="background:${hex(PALETTE.weather.Severe)}"></span><span class="lg-l">Weather</span><span class="lg-n">NWS active alert</span></div>

      <div class="lg-group">Reference</div>
      <div class="lg-row"><span class="lg-sw" style="background:${hex(PALETTE.reference.city)}"></span><span class="lg-l">Cities</span><span class="lg-n">context only — never a signal</span></div>
      <div class="lg-row"><span class="lg-sw" style="background:${hex(PALETTE.selection)}"></span><span class="lg-l">Selection</span><span class="lg-n">your current pick</span></div>

      <div class="lg-rule lg-rule-b">Scale note: aircraft altitude is exaggerated ×8 and orbital altitude is logarithmically compressed. Horizontal position, heading and ground tracks are geometrically exact.</div>`;
    document.body.appendChild(el);
    this.legendEl = el;
    el.querySelector('#lg-close').addEventListener('click', () => this.toggleLegend(false));
  }

  toggleLegend(force) {
    const on = force != null ? force : !this.legendEl.classList.contains('open');
    this.legendEl.classList.toggle('open', on);
    this._syncContext?.();
  }

  /* ══ Keyboard map ══════════════════════════════════════════════ */

  _buildKeymap() {
    const el = document.createElement('div');
    el.id = 'keymap';
    el.innerHTML = `<div class="km-shell glass">
      <div class="km-head"><span>Keyboard</span><button class="lg-x" id="km-close">✕</button></div>
      <div class="km-grid" id="km-grid"></div>
      <div class="km-note">Every action in this tool is reachable without a pointer.</div>
    </div>`;
    document.body.appendChild(el);
    this.keymapEl = el;
    el.querySelector('#km-close').addEventListener('click', () => this.toggleKeymap(false));
    el.addEventListener('mousedown', (e) => { if (e.target === el) this.toggleKeymap(false); });
  }

  toggleKeymap(force) {
    const on = force != null ? force : !this.keymapEl.classList.contains('open');
    if (on) {
      const groups = {};
      for (const c of this.commands) {
        if (!c.keys) continue;
        (groups[c.group || 'General'] ||= []).push(c);
      }
      document.getElementById('km-grid').innerHTML = Object.entries(groups).map(([g, cmds]) =>
        `<div class="km-group"><div class="km-gtitle">${escapeHtml(g)}</div>${cmds.map(c =>
          `<div class="km-row"><span class="km-keys">${c.keys.map(k => `<kbd>${k}</kbd>`).join('')}</span><span class="km-label">${escapeHtml(c.label)}</span></div>`
        ).join('')}</div>`).join('');
    }
    this.keymapEl.classList.toggle('open', on);
  }

  /* ══ Keys ══════════════════════════════════════════════════════ */

  _bindKeys() {
    window.addEventListener('keydown', (e) => {
      const inField = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;

      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault(); this.paletteOpen ? this.closePalette() : this.openPalette(); return;
      }
      if (this.paletteOpen) return;
      if (inField) return;

      if (e.key === '/') { e.preventDefault(); this.openPalette(); return; }
      if (e.key === '?') { e.preventDefault(); this.toggleKeymap(); return; }
      if (e.key === 'Escape') {
        if (this.keymapEl.classList.contains('open')) { this.toggleKeymap(false); return; }
        if (this.legendEl.classList.contains('open')) { this.toggleLegend(false); return; }
        selection.clear(); return;
      }

      for (const c of this.commands) {
        if (!c.keys || c.keys.length !== 1) continue;
        const k = c.keys[0];
        if (k.length === 1 && e.key.toLowerCase() === k.toLowerCase() && !e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault(); c.run(); return;
        }
      }
    });
  }

  toast(msg, tone = 'info', ms = 3200) {
    let host = document.getElementById('toasts');
    if (!host) {
      host = document.createElement('div'); host.id = 'toasts';
      document.body.appendChild(host);
    }
    const t = document.createElement('div');
    t.className = 'toast toast-' + tone;
    t.textContent = msg;
    host.appendChild(t);
    requestAnimationFrame(() => t.classList.add('in'));
    setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 300); }, ms);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
