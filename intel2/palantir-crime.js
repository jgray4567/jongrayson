/* =============================================
   PALANTIR-STYLE CRIME INTELLIGENCE UI
   ============================================= */

// State
let palantirWatchlist = JSON.parse(localStorage.getItem('palantir_watchlist') || '[]');
let palantirNotes = localStorage.getItem('palantir_notes') || '';
let palantirSeverityFilter = 'all';
let palantirDateFrom = null;
let palantirDateTo = null;
let palantirZoneFilter = 'all';
let palantirInitialized = false;
let palantirTimelineCanvas = null;

const PALANTIR_COLORS = {
  Violent: '#ff1744',
  Property: '#2979ff',
  Drug: '#00e676',
  Other: '#78909c'
};

const PALANTIR_SEVERITY = {
  Violent: 'high',
  Property: 'medium',
  Drug: 'low',
  Other: 'low'
};

function initPalantirCrimeUI() {
  if (palantirInitialized) return;
  palantirInitialized = true;

  // Show UI elements
  const ribbon = document.getElementById('palantir-stats-ribbon');
  const rail = document.getElementById('palantir-left-rail');
  const railToggle = document.getElementById('palantir-rail-toggle');
  const timelineBar = document.getElementById('palantir-timeline-bar');

  if (ribbon) ribbon.style.display = 'flex';
  if (rail) { rail.style.display = 'flex'; rail.classList.add('open'); }
  if (railToggle) railToggle.style.display = 'block';
  if (timelineBar) timelineBar.style.display = 'flex';

  // Restore notes
  const notesEl = document.getElementById('palantir-notes');
  if (notesEl) notesEl.value = palantirNotes;

  // Bind category filters
  document.querySelectorAll('#palantir-category-filters .palantir-cat-bar').forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = btn.dataset.category;
      btn.classList.toggle('active');
      if (btn.classList.contains('active')) {
        pittsburghVisibleCategories.add(cat);
      } else {
        pittsburghVisibleCategories.delete(cat);
      }
      applyPalantirFilters();
    });
  });

  // Bind date range
  const dateFrom = document.getElementById('palantir-date-from');
  const dateTo = document.getElementById('palantir-date-to');
  if (dateFrom) dateFrom.addEventListener('change', () => { palantirDateFrom = dateFrom.value || null; applyPalantirFilters(); });
  if (dateTo) dateTo.addEventListener('change', () => { palantirDateTo = dateTo.value || null; applyPalantirFilters(); });

  // Set default date range from data
  if (pittsburghCrimesData.length && dateFrom && dateTo) {
    const times = pittsburghCrimesData.map(c => c.time).filter(Boolean).sort();
    if (times.length) {
      dateFrom.value = times[0].slice(0, 10);
      dateTo.value = times[times.length - 1].slice(0, 10);
      palantirDateFrom = dateFrom.value;
      palantirDateTo = dateTo.value;
    }
  }

  // Bind zone select
  const zoneSelect = document.getElementById('palantir-zone-select');
  if (zoneSelect) zoneSelect.addEventListener('change', () => { palantirZoneFilter = zoneSelect.value; applyPalantirFilters(); });

  // Bind severity
  document.querySelectorAll('.palantir-severity-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.palantir-severity-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      palantirSeverityFilter = btn.dataset.severity;
      applyPalantirFilters();
    });
  });

  // Bind overlay toggles
  const heatBtn = document.getElementById('palantir-toggle-heatmap');
  const clusterBtn = document.getElementById('palantir-toggle-clusters');
  const dangerBtn = document.getElementById('palantir-toggle-danger');

  if (heatBtn) heatBtn.addEventListener('click', () => {
    heatBtn.classList.toggle('active');
    pittsburghHeatVisible = heatBtn.classList.contains('active');
    if (pittsburghHeatVisible && pittsburghHeatLayer) {
      pittsburghHeatLayer.addTo(cityMapInstance);
    } else if (pittsburghHeatLayer) {
      cityMapInstance.removeLayer(pittsburghHeatLayer);
    }
    const oldHeatBtn = document.getElementById('toggle-heatmap');
    if (oldHeatBtn) oldHeatBtn.classList.toggle('active', pittsburghHeatVisible);
  });

  if (dangerBtn) dangerBtn.addEventListener('click', () => {
    dangerBtn.classList.toggle('active');
    if (dangerBtn.classList.contains('active')) {
      toggleDangerZones();
    } else {
      if (pittsburghDangerLayer) cityMapInstance.removeLayer(pittsburghDangerLayer);
      pittsburghDangerVisible = false;
    }
  });

  if (clusterBtn) clusterBtn.addEventListener('click', () => {
    clusterBtn.classList.toggle('active');
    applyPalantirFilters();
  });

  // Rail toggle
  if (railToggle) railToggle.addEventListener('click', () => {
    if (rail) {
      rail.classList.toggle('open');
      rail.classList.toggle('collapsed');
    }
  });

  // Drawer close
  const drawerClose = document.getElementById('palantir-drawer-close');
  if (drawerClose) drawerClose.addEventListener('click', closePalantirDrawer);

  // Notes autosave
  if (notesEl) notesEl.addEventListener('input', () => {
    palantirNotes = notesEl.value;
    localStorage.setItem('palantir_notes', palantirNotes);
  });

  // Export brief
  const exportBtn = document.getElementById('palantir-export-brief');
  if (exportBtn) exportBtn.addEventListener('click', exportPalantirBrief);

  // Initial render
  applyPalantirFilters();
}

function getFilteredCrimes() {
  let crimes = pittsburghCrimesData;

  // Category filter
  crimes = crimes.filter(c => pittsburghVisibleCategories.has(c.category));

  // Date range
  if (palantirDateFrom) {
    crimes = crimes.filter(c => c.time && c.time >= palantirDateFrom);
  }
  if (palantirDateTo) {
    crimes = crimes.filter(c => c.time && c.time <= palantirDateTo + ' 23:59');
  }

  // Zone
  if (palantirZoneFilter !== 'all') {
    crimes = crimes.filter(c => c.zone === palantirZoneFilter);
  }

  // Severity
  if (palantirSeverityFilter !== 'all') {
    crimes = crimes.filter(c => {
      const sev = PALANTIR_SEVERITY[c.category] || 'low';
      return sev === palantirSeverityFilter;
    });
  }

  return crimes;
}

function applyPalantirFilters() {
  const crimes = getFilteredCrimes();

  // Update stats
  updatePalantirStats(crimes);

  // Re-render markers with glow
  renderPalantirMarkers(crimes);

  // Re-render heatmap
  renderCrimeHeatmap(crimes);

  // Build timeline
  drawPalantirTimeline(crimes);

  // Build pattern panel
  buildPalantirPatternPanel(crimes);

  // Update watchlist display
  updatePalantirWatchlist();
}

function updatePalantirStats(crimes) {
  const total = crimes.length;
  const violent = crimes.filter(c => c.category === 'Violent').length;
  const property = crimes.filter(c => c.category === 'Property').length;
  const drug = crimes.filter(c => c.category === 'Drug').length;
  const other = crimes.filter(c => c.category === 'Other').length;

  // Count hotspots (grid cells with 5+ incidents)
  const grid = {};
  crimes.forEach(c => {
    const key = `${(Math.round(c.lat * 1000) / 1000).toFixed(3)},${(Math.round(c.lng * 1000) / 1000).toFixed(3)}`;
    grid[key] = (grid[key] || 0) + 1;
  });
  const hotspots = Object.values(grid).filter(v => v >= 5).length;

  // Count active threats (danger zones if loaded)
  const threats = pittsburghDangerVisible && pittsburghDangerLayer ? 'LIVE' : '—';

  const el = (id) => document.getElementById(id);
  if (el('pstat-total')) el('pstat-total').textContent = total.toLocaleString();
  if (el('pstat-violent')) el('pstat-violent').textContent = violent.toLocaleString();
  if (el('pstat-property')) el('pstat-property').textContent = property.toLocaleString();
  if (el('pstat-drug')) el('pstat-drug').textContent = drug.toLocaleString();
  if (el('pstat-threats')) el('pstat-threats').textContent = threats;
  if (el('pstat-hotspots')) el('pstat-hotspots').textContent = hotspots;

  // Update time
  const timeEl = el('palantir-update-time');
  if (timeEl) {
    const now = new Date();
    timeEl.textContent = `Updated ${now.toLocaleTimeString('en-US', {hour:'2-digit',minute:'2-digit'})}`;
  }

  // Update category bars
  const maxCat = Math.max(violent, property, drug, other, 1);
  const barData = [
    { id: 'pbar-violent', count: violent, pct: (violent / maxCat * 100) },
    { id: 'pbar-property', count: property, pct: (property / maxCat * 100) },
    { id: 'pbar-drug', count: drug, pct: (drug / maxCat * 100) },
    { id: 'pbar-other', count: other, pct: (other / maxCat * 100) }
  ];
  barData.forEach(b => {
    const countEl = el(b.id);
    if (countEl) countEl.textContent = b.count.toLocaleString();
    const barBtn = countEl?.closest('.palantir-cat-bar');
    const fill = barBtn?.querySelector('.palantir-cat-bar-fill');
    if (fill) fill.style.width = b.pct + '%';
  });

  // Render donut chart
  renderPalantirDonut(violent, property, drug, other);

  // Render sparklines
  renderPalantirSparklines(crimes);
}

function renderPalantirMarkers(crimes) {
  if (!cityMapInstance) return;

  // Remove old markers
  if (pittsburghCrimesLayer) {
    cityMapInstance.removeLayer(pittsburghCrimesLayer);
  }
  pittsburghCrimesLayer = L.layerGroup();

  const useClusters = document.getElementById('palantir-toggle-clusters')?.classList.contains('active');

  crimes.forEach((crime) => {
    const color = PALANTIR_COLORS[crime.category] || '#78909c';
    const isViolent = crime.category === 'Violent';

    const marker = L.circleMarker([crime.lat, crime.lng], {
      radius: isViolent ? 5 : 3.5,
      stroke: isViolent,
      color: isViolent ? color : 'rgba(255,255,255,0.3)',
      weight: isViolent ? 1.5 : 0.5,
      fillOpacity: isViolent ? 0.85 : 0.7,
      fillColor: color,
      className: isViolent ? 'crime-marker-pulse' : ''
    });

    marker.on('click', () => openPalantirDrawer(crime));

    pittsburghCrimesLayer.addLayer(marker);
  });

  pittsburghCrimesLayer.addTo(cityMapInstance);

  // Sync marker visibility
  if (!pittsburghMarkersVisible) {
    cityMapInstance.removeLayer(pittsburghCrimesLayer);
  }
}

function openPalantirDrawer(crime) {
  const drawer = document.getElementById('palantir-drawer');
  const catEl = document.getElementById('palantir-drawer-category');
  const titleEl = document.getElementById('palantir-drawer-title');
  const bodyEl = document.getElementById('palantir-drawer-body');
  const sevBar = document.getElementById('palantir-drawer-severity-bar');
  const caseIdEl = document.getElementById('palantir-drawer-case-id');

  if (!drawer || !bodyEl) return;

  const color = PALANTIR_COLORS[crime.category] || '#78909c';
  const severity = PALANTIR_SEVERITY[crime.category] || 'low';
  const isWatchlisted = palantirWatchlist.some(w => w.lat === crime.lat && w.lng === crime.lng && w.time === crime.time);

  // Set severity bar
  if (sevBar) {
    sevBar.className = 'palantir-severity-bar ' + severity;
  }

  // Set category badge
  if (catEl) {
    catEl.style.background = color + '22';
    catEl.style.borderLeft = '3px solid ' + color;
    catEl.style.color = color;
    catEl.textContent = crime.category;
  }
  if (titleEl) titleEl.textContent = crime.incident_type || 'Unknown Incident';

  // Generate case ID
  const caseId = 'PI-' + (crime.zone || 'X') + '-' + new Date(crime.time || Date.now()).toISOString().slice(0,10).replace(/-/g,'') + '-' + Math.abs(Math.round((crime.lat || 0) * 1000)).toString(36).toUpperCase();
  if (caseIdEl) caseIdEl.textContent = caseId;

  // Find related incidents
  const related = findRelatedIncidents(crime);

  // Build heat grid
  const heatGrid = buildHeatGrid(crime);

  // Build node visualization
  const nodeViz = buildNodeViz(crime, related);

  bodyEl.innerHTML = `
    <div class="palantir-drawer-section">
      <div class="palantir-drawer-section-title">Intelligence Summary</div>
      <div class="palantir-drawer-field"><span class="label">Type</span><span class="value">${crime.incident_type || 'N/A'}</span></div>
      <div class="palantir-drawer-field"><span class="label">Category</span><span class="value" style="color:${color}">${crime.category}</span></div>
      <div class="palantir-drawer-field"><span class="label">Zone</span><span class="value">${crime.zone || 'N/A'}</span></div>
      <div class="palantir-drawer-field"><span class="label">Coordinates</span><span class="value">${crime.lat?.toFixed(4)}, ${crime.lng?.toFixed(4)}</span></div>
      <div class="palantir-drawer-field"><span class="label">Time</span><span class="value">${crime.time || 'N/A'}</span></div>
      <div class="palantir-drawer-field"><span class="label">Severity</span><span class="value" style="color:${severity === 'high' ? '#ff1744' : severity === 'medium' ? '#2979ff' : '#00e676'}">${severity.toUpperCase()}</span></div>
    </div>
    <div class="palantir-drawer-section">
      <div class="palantir-drawer-section-title">Temporal Pattern — 7×24 Heat Grid</div>
      ${heatGrid}
    </div>
    <div class="palantir-drawer-section">
      <div class="palantir-drawer-section-title">Related Incidents (${related.length})</div>
      <div class="palantir-node-viz">${nodeViz}</div>
      <div class="palantir-drawer-related">
        ${related.slice(0, 8).map(r => `
          <div class="palantir-related-item" onclick='openPalantirDrawer(${JSON.stringify(r).replace(/'/g, "&#39;")})'>
            <div><span class="palantir-related-dot" style="background:${PALANTIR_COLORS[r.category] || '#78909c'}"></span>${r.incident_type?.substring(0, 30) || 'Unknown'}</div>
            <div style="color:var(--muted)">${r.time?.substring(5, 16) || ''}</div>
          </div>
        `).join('')}
      </div>
    </div>
    <div class="palantir-drawer-section">
      <div class="palantir-drawer-section-title">Investigative Leads</div>
      <div style="font-family:var(--font-mono);font-size:11px;color:var(--muted);line-height:1.6;">
        ${generateLeads(crime, related)}
      </div>
    </div>
    <div style="margin-top:12px;">
      <button onclick="togglePalantirWatchlistItem(${crime.lat},${crime.lng},'${crime.time?.replace(/'/g, "\\'") || ''}','${crime.incident_type?.replace(/'/g, "\\'") || ''}','${crime.category}')" 
        style="background:${isWatchlisted ? '#ffd60022' : 'rgba(255,255,255,0.04)'};border:1px solid ${isWatchlisted ? '#ffd600' : 'var(--border)'};color:${isWatchlisted ? '#ffd600' : 'var(--muted)'};padding:8px 12px;border-radius:3px;cursor:pointer;font-family:var(--font-mono);font-size:10px;width:100%;text-transform:uppercase;letter-spacing:0.06em;transition:all 0.15s ease;">
        ${isWatchlisted ? '★ Watchlisted' : '☆ Add to Watchlist'}
      </button>
    </div>
  `;

  drawer.classList.add('open');
}

function closePalantirDrawer() {
  const drawer = document.getElementById('palantir-drawer');
  if (drawer) drawer.classList.remove('open');
}

function findRelatedIncidents(crime) {
  if (!crime || !crime.lat || !crime.lng) return [];
  const crimeTime = crime.time ? new Date(crime.time).getTime() : 0;
  return pittsburghCrimesData.filter(c => {
    if (c === crime) return false;
    const dist = haversineMeters(crime.lat, crime.lng, c.lat, c.lng);
    const timeDiff = crimeTime ? Math.abs(new Date(c.time).getTime() - crimeTime) : Infinity;
    return dist < 500 && timeDiff < 3600000; // 500m, 1hr
  }).sort((a, b) => {
    const distA = haversineMeters(crime.lat, crime.lng, a.lat, a.lng);
    const distB = haversineMeters(crime.lat, crime.lng, b.lat, b.lng);
    return distA - distB;
  }).slice(0, 10);
}

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function generateLeads(crime, related) {
  const leads = [];
  if (crime.category === 'Violent') leads.push('• Correlate with nearby property crimes — violent incidents often cluster with theft.');
  if (related.length >= 3) leads.push(`• ${related.length} related incidents within 500m/1hr — potential serial pattern.`);
  if (crime.zone) leads.push(`• Cross-reference Zone ${crime.zone} historical trends for escalation indicators.`);
  const hour = crime.time ? new Date(crime.time).getHours() : 0;
  if (hour >= 22 || hour < 4) leads.push('• Late-night incident — check for lighting/infrastructure gaps.');
  if (related.filter(r => r.category === 'Violent').length >= 2) leads.push('• Multiple violent incidents nearby — recommend enhanced patrol coverage.');
  if (leads.length === 0) leads.push('• No immediate leads — monitor for pattern emergence.');
  return leads.join('<br>');
}

// ── 7×24 Heat Grid ──
function buildHeatGrid(crime) {
  if (!pittsburghCrimesData || pittsburghCrimesData.length === 0) return '<div style="color:var(--muted);font-family:var(--font-mono);font-size:10px;">No data</div>';

  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const hours = Array.from({length:24}, (_,i) => i);
  const grid = {};
  days.forEach(d => { grid[d] = {}; hours.forEach(h => { grid[d][h] = 0; }); });

  const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  pittsburghCrimesData.forEach(c => {
    if (!c.time) return;
    const dt = new Date(c.time);
    const dayAbbr = days[(dayNames.indexOf(dayNames[dt.getDay()]) + 6) % 7] || days[dt.getDay() === 0 ? 6 : dt.getDay() - 1];
    const hr = dt.getHours();
    if (grid[dayAbbr] !== undefined) grid[dayAbbr][hr]++;
  });

  // Recalculate with correct day mapping
  Object.keys(grid).forEach(d => hours.forEach(h => { grid[d][h] = 0; }));
  pittsburghCrimesData.forEach(c => {
    if (!c.time) return;
    const dt = new Date(c.time);
    // JS: 0=Sun, 1=Mon, ... 6=Sat → our grid: 0=Mon, ..., 6=Sun
    const dayIdx = dt.getDay() === 0 ? 6 : dt.getDay() - 1;
    const dayAbbr = days[dayIdx];
    const hr = dt.getHours();
    if (grid[dayAbbr]) grid[dayAbbr][hr]++;
  });

  const maxVal = Math.max(1, ...Object.values(grid).flatMap(d => Object.values(d)));
  const crimeHour = crime.time ? new Date(crime.time).getHours() : -1;
  const crimeDayIdx = crime.time ? (new Date(crime.time).getDay() === 0 ? 6 : new Date(crime.time).getDay() - 1) : -1;
  const crimeDay = crimeDayIdx >= 0 ? days[crimeDayIdx] : null;

  // Day labels on left
  let html = '<div style="display:flex;">';
  html += '<div style="display:flex;flex-direction:column;gap:1px;padding-right:3px;">';
  html += '<div style="height:8px;"></div>'; // header spacer
  days.forEach(d => {
    html += `<div class="palantir-heat-label" style="height:4px;display:flex;align-items:center;">${d}</div>`;
  });
  html += '</div>';

  // Grid cells
  html += '<div style="flex:1;">';
  html += '<div class="palantir-heat-grid">';
  days.forEach(d => {
    hours.forEach(h => {
      const val = grid[d][h];
      const intensity = val / maxVal;
      const isCrimeCell = (d === crimeDay && h === crimeHour);
      const color = intensity === 0 ? 'rgba(255,255,255,0.02)' :
        intensity < 0.25 ? 'rgba(255,23,68,0.15)' :
        intensity < 0.5 ? 'rgba(255,23,68,0.35)' :
        intensity < 0.75 ? 'rgba(255,23,68,0.55)' : 'rgba(255,23,68,0.8)';
      const border = isCrimeCell ? '2px solid #fff' : 'none';
      html += `<div class="palantir-heat-cell" style="background:${color};${isCrimeCell ? 'border:'+border+';' : ''}" title="${d} ${h}:00 — ${val} incidents"></div>`;
    });
  });
  html += '</div>';
  // Hour labels
  html += '<div style="display:flex;gap:1px;">';
  [0,6,12,18,23].forEach(h => {
    html += `<div class="palantir-heat-label" style="flex:1;text-align:${h===0?'left':h===23?'right':'center'};">${h}</div>`;
  });
  html += '</div>';
  html += '</div></div>';
  return html;
}

// ── Node Visualization ──
function buildNodeViz(crime, related) {
  if (!related || related.length === 0) return '';

  const nodes = [{ ...crime, isCenter: true }];
  related.slice(0, 6).forEach(r => nodes.push({ ...r, isCenter: false }));

  const W = 308, H = 120;
  const cx = W / 2, cy = H / 2;
  const radius = 38;

  let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;

  // Position center node
  const centerNode = nodes[0];
  const centerColor = PALANTIR_COLORS[centerNode.category] || '#78909c';

  // Draw connections first (behind nodes)
  nodes.slice(1).forEach((n, i) => {
    const angle = (i / (nodes.length - 1)) * Math.PI * 2 - Math.PI / 2;
    const nx = cx + radius * 1.8 * Math.cos(angle);
    const ny = cy + radius * 1.1 * Math.sin(angle);
    const nodeColor = PALANTIR_COLORS[n.category] || '#78909c';
    svg += `<line x1="${cx}" y1="${cy}" x2="${nx}" y2="${ny}" stroke="${nodeColor}" stroke-opacity="0.15" stroke-width="1"/>`;
  });

  // Draw outer nodes
  nodes.slice(1).forEach((n, i) => {
    const angle = (i / (nodes.length - 1)) * Math.PI * 2 - Math.PI / 2;
    const nx = cx + radius * 1.8 * Math.cos(angle);
    const ny = cy + radius * 1.1 * Math.sin(angle);
    const nodeColor = PALANTIR_COLORS[n.category] || '#78909c';
    svg += `<circle cx="${nx}" cy="${ny}" r="4" fill="${nodeColor}" fill-opacity="0.8"/>`;
    const label = (n.incident_type || 'Incident').substring(0, 12);
    svg += `<text x="${nx}" y="${ny + 12}" text-anchor="middle" fill="${nodeColor}" fill-opacity="0.6" font-family="var(--font-mono)" font-size="6">${label}</text>`;
  });

  // Draw center node on top
  svg += `<circle cx="${cx}" cy="${cy}" r="8" fill="${centerColor}" fill-opacity="0.9"/>`;
  svg += `<circle cx="${cx}" cy="${cy}" r="12" fill="none" stroke="${centerColor}" stroke-opacity="0.3" stroke-width="1"/>`;

  svg += '</svg>';
  return svg;
}

function togglePalantirWatchlistItem(lat, lng, time, name, category) {
  const idx = palantirWatchlist.findIndex(w => w.lat === lat && w.lng === lng && w.time === time);
  if (idx >= 0) {
    palantirWatchlist.splice(idx, 1);
  } else {
    palantirWatchlist.push({ lat, lng, time, name, category });
  }
  localStorage.setItem('palantir_watchlist', JSON.stringify(palantirWatchlist));
  updatePalantirWatchlist();
  // Re-open drawer to update watchlist button state
  const crime = { lat, lng, time, incident_type: name, category };
  openPalantirDrawer(crime);
}

function updatePalantirWatchlist() {
  const panel = document.getElementById('palantir-watchlist-panel');
  const countEl = document.getElementById('palantir-watchlist-count');
  if (countEl) countEl.textContent = palantirWatchlist.length;
  if (!panel) return;

  if (palantirWatchlist.length === 0) {
    panel.innerHTML = '<div style="font-family:var(--font-mono);font-size:10px;color:var(--muted);">No flagged incidents</div>';
    return;
  }

  panel.innerHTML = palantirWatchlist.slice(0, 10).map(w => `
    <div class="palantir-watchlist-item" onclick="openPalantirDrawer({lat:${w.lat},lng:${w.lng},time:'${w.time?.replace(/'/g, "\\'") || ''}',incident_type:'${w.name?.replace(/'/g, "\\'") || ''}',category:'${w.category}'})">
      <div style="display:flex;align-items:center;gap:6px;">
        <span class="palantir-watchlist-star active">★</span>
        <span style="color:${PALANTIR_COLORS[w.category] || '#78909c'}">${w.name?.substring(0, 20) || 'Unknown'}</span>
      </div>
      <div style="color:var(--muted)">${w.time?.substring(5, 10) || ''}</div>
    </div>
  `).join('');
}

function buildPalantirPatternPanel(crimes) {
  const panel = document.getElementById('palantir-pattern-panel');
  if (!panel) return;

  const patterns = [];

  // Repeat location analysis
  const locCounts = {};
  crimes.forEach(c => {
    const key = `${c.lat?.toFixed(3)},${c.lng?.toFixed(3)}`;
    locCounts[key] = (locCounts[key] || 0) + 1;
  });
  const repeatLocs = Object.entries(locCounts).filter(([, v]) => v >= 5).sort((a, b) => b[1] - a[1]);
  if (repeatLocs.length > 0) {
    patterns.push({ type: 'repeat', severity: repeatLocs[0][1] >= 10 ? 'volatile' : 'rising', desc: `${repeatLocs.length} repeat locations (${repeatLocs[0][1]} max)`, meta: `${repeatLocs.length} locations with 5+ incidents` });
  }

  // Temporal hotspot
  const hourCounts = {};
  crimes.forEach(c => {
    if (!c.time) return;
    const h = new Date(c.time).getHours();
    hourCounts[h] = (hourCounts[h] || 0) + 1;
  });
  const peakHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0];
  if (peakHour) {
    patterns.push({ type: 'temporal', severity: peakHour[1] >= crimes.length * 0.08 ? 'volatile' : 'rising', desc: `Peak hour: ${peakHour[0]}:00 (${peakHour[1]} incidents)`, meta: `${(peakHour[1] / crimes.length * 100).toFixed(1)}% of visible incidents` });
  }

  // Zone concentration
  const zoneCounts = {};
  crimes.forEach(c => { zoneCounts[c.zone || '?'] = (zoneCounts[c.zone || '?'] || 0) + 1; });
  const topZone = Object.entries(zoneCounts).sort((a, b) => b[1] - a[1])[0];
  if (topZone) {
    patterns.push({ type: 'zone', severity: topZone[1] >= crimes.length * 0.3 ? 'volatile' : 'stable', desc: `Zone ${topZone[0]} concentration: ${topZone[1]} incidents`, meta: `${(topZone[1] / crimes.length * 100).toFixed(1)}% of visible area` });
  }

  // Category trend
  const violentCount = crimes.filter(c => c.category === 'Violent').length;
  const violentPct = crimes.length ? (violentCount / crimes.length * 100) : 0;
  patterns.push({ type: 'trend', severity: violentPct > 25 ? 'volatile' : violentPct > 15 ? 'rising' : 'stable', desc: `Violent ratio: ${violentPct.toFixed(1)}%`, meta: `${violentCount} of ${crimes.length} total` });

  panel.innerHTML = patterns.map(p => `
    <div class="palantir-pattern-item pattern-${p.severity}" onclick="this.classList.toggle('expanded')">
      <div class="palantir-pattern-type">${p.type}</div>
      <div class="palantir-pattern-desc">${p.desc}</div>
      <div class="palantir-pattern-meta">${p.meta}</div>
    </div>
  `).join('');
}

let palantirTimelineTooltip = null;
let palantirTimelineScanX = null;
let palantirTimelineAnimFrame = null;

function drawPalantirTimeline(crimes) {
  const canvas = document.getElementById('palantir-timeline-canvas');
  const rangeEl = document.getElementById('palantir-timeline-range');
  if (!canvas) return;

  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width * (window.devicePixelRatio || 1);
  canvas.height = rect.height * (window.devicePixelRatio || 1);
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';

  const ctx = canvas.getContext('2d');
  ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
  const w = rect.width;
  const h = rect.height;

  // Group by date
  const dateCounts = {};
  crimes.forEach(c => {
    if (!c.time) return;
    const d = c.time.substring(0, 10);
    if (!dateCounts[d]) dateCounts[d] = { total: 0, Violent: 0, Property: 0, Drug: 0, Other: 0 };
    dateCounts[d].total++;
    dateCounts[d][c.category]++;
  });

  const dates = Object.keys(dateCounts).sort();
  if (dates.length === 0) return;

  const maxCount = Math.max(...dates.map(d => dateCounts[d].total));

  if (rangeEl) {
    rangeEl.textContent = `${dates[0]} → ${dates[dates.length - 1]}`;
  }

  // Store for tooltip
  canvas._tlDates = dates;
  canvas._tlDateCounts = dateCounts;
  canvas._tlMaxCount = maxCount;
  canvas._tlBarW = Math.max(1, (w - 4) / dates.length);
  canvas._tlW = w;
  canvas._tlH = h;

  // Draw stacked bars
  const barW = canvas._tlBarW;
  const categories = ['Violent', 'Property', 'Drug', 'Other'];

  // Clear
  ctx.clearRect(0, 0, w, h);

  // Background scan line position (will be drawn in animation loop)
  dates.forEach((date, i) => {
    const counts = dateCounts[date];
    let y = h - 2;
    categories.forEach(cat => {
      const count = counts[cat] || 0;
      if (count === 0) return;
      const barH = (count / maxCount) * (h - 4);
      ctx.fillStyle = PALANTIR_COLORS[cat] + '99';
      ctx.fillRect(2 + i * barW, y - barH, Math.max(1, barW - 1), barH);
      y -= barH;
    });
  });

  // Add tooltip container if not exists
  if (!palantirTimelineTooltip) {
    palantirTimelineTooltip = document.createElement('div');
    palantirTimelineTooltip.style.cssText = 'position:absolute;background:rgba(8,10,14,0.95);border:1px solid var(--border);border-radius:3px;padding:6px 10px;font-family:var(--font-mono);font-size:10px;pointer-events:none;z-index:2000;white-space:nowrap;backdrop-filter:blur(8px);display:none;';
    canvas.parentElement.style.position = 'relative';
    canvas.parentElement.appendChild(palantirTimelineTooltip);
  }

  // Hover handler
  canvas.onmousemove = (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const idx = Math.floor((x - 2) / canvas._tlBarW);
    if (idx >= 0 && idx < canvas._tlDates.length) {
      const date = canvas._tlDates[idx];
      const counts = canvas._tlDateCounts[date];
      palantirTimelineTooltip.innerHTML = `<div style="color:var(--text);font-weight:700;margin-bottom:3px;">${date}</div><div style="color:#ff1744;">Violent: ${counts.Violent}</div><div style="color:#2979ff;">Property: ${counts.Property}</div><div style="color:#00e676;">Drug: ${counts.Drug}</div><div style="color:#78909c;">Other: ${counts.Other}</div><div style="color:var(--text);margin-top:2px;border-top:1px solid rgba(255,255,255,0.1);padding-top:2px;">Total: ${counts.total}</div>`;
      palantirTimelineTooltip.style.display = 'block';
      palantirTimelineTooltip.style.left = (x + 10) + 'px';
      palantirTimelineTooltip.style.top = '-60px';
    } else {
      palantirTimelineTooltip.style.display = 'none';
    }
  };
  canvas.onmouseleave = () => {
    if (palantirTimelineTooltip) palantirTimelineTooltip.style.display = 'none';
  };

  // Start scan line animation
  startTimelineScanLine(canvas, ctx, dates, dateCounts, maxCount, categories, w, h);
}

// ── Timeline Scan Line Animation ──
function startTimelineScanLine(canvas, ctx, dates, dateCounts, maxCount, categories, w, h) {
  if (palantirTimelineAnimFrame) cancelAnimationFrame(palantirTimelineAnimFrame);
  
  let scanX = 0;
  const speed = 0.3; // pixels per frame
  const barW = canvas._tlBarW;
  
  function animate() {
    // Redraw bars
    ctx.clearRect(0, 0, w, h);
    dates.forEach((date, i) => {
      const counts = dateCounts[date];
      let y = h - 2;
      categories.forEach(cat => {
        const count = counts[cat] || 0;
        if (count === 0) return;
        const barH = (count / maxCount) * (h - 4);
        ctx.fillStyle = PALANTIR_COLORS[cat] + '99';
        ctx.fillRect(2 + i * barW, y - barH, Math.max(1, barW - 1), barH);
        y -= barH;
      });
    });
    
    // Draw scan line
    if (scanX >= w) scanX = 0;
    ctx.beginPath();
    ctx.moveTo(scanX, 0);
    ctx.lineTo(scanX, h);
    ctx.strokeStyle = 'rgba(0,229,255,0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Glow effect
    const gradient = ctx.createLinearGradient(scanX - 15, 0, scanX, 0);
    gradient.addColorStop(0, 'rgba(0,229,255,0)');
    gradient.addColorStop(1, 'rgba(0,229,255,0.06)');
    ctx.fillStyle = gradient;
    ctx.fillRect(Math.max(0, scanX - 15), 0, 15, h);
    
    scanX += speed;
    palantirTimelineAnimFrame = requestAnimationFrame(animate);
  }
  
  animate();
}

function exportPalantirBrief() {
  const crimes = getFilteredCrimes();
  const violent = crimes.filter(c => c.category === 'Violent').length;
  const property = crimes.filter(c => c.category === 'Property').length;
  const drug = crimes.filter(c => c.category === 'Drug').length;
  const other = crimes.filter(c => c.category === 'Other').length;

  const dateFrom = palantirDateFrom || 'N/A';
  const dateTo = palantirDateTo || 'N/A';
  const zone = palantirZoneFilter === 'all' ? 'All Zones' : `Zone ${palantirZoneFilter}`;

  let brief = `INTELLIGENCE BRIEF\n`;
  brief += `${'='.repeat(40)}\n`;
  brief += `Generated: ${new Date().toISOString()}\n`;
  brief += `Date Range: ${dateFrom} → ${dateTo}\n`;
  brief += `Zone: ${zone}\n`;
  brief += `Severity Filter: ${palantirSeverityFilter.toUpperCase()}\n\n`;
  brief += `SUMMARY\n`;
  brief += `${'─'.repeat(40)}\n`;
  brief += `Total Incidents: ${crimes.length.toLocaleString()}\n`;
  brief += `  Violent:  ${violent.toLocaleString()}\n`;
  brief += `  Property: ${property.toLocaleString()}\n`;
  brief += `  Drug:     ${drug.toLocaleString()}\n`;
  brief += `  Other:    ${other.toLocaleString()}\n\n`;

  // Top incident types
  const typeCounts = {};
  crimes.forEach(c => { typeCounts[c.incident_type] = (typeCounts[c.incident_type] || 0) + 1; });
  const topTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  brief += `TOP INCIDENT TYPES\n`;
  brief += `${'─'.repeat(40)}\n`;
  topTypes.forEach(([type, count]) => { brief += `  ${type}: ${count}\n`; });

  brief += `\nWATCHLIST (${palantirWatchlist.length} items)\n`;
  brief += `${'─'.repeat(40)}\n`;
  palantirWatchlist.forEach(w => { brief += `  ★ ${w.name} | ${w.time} | ${w.category} | ${w.lat}, ${w.lng}\n`; });

  brief += `\nANALYST NOTES\n`;
  brief += `${'─'.repeat(40)}\n`;
  brief += palantirNotes || '(no notes)';

  // Download
  const blob = new Blob([brief], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `intel-brief-${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

// Make functions globally accessible
window.initPalantirCrimeUI = initPalantirCrimeUI;
window.openPalantirDrawer = openPalantirDrawer;
window.closePalantirDrawer = closePalantirDrawer;
window.togglePalantirWatchlistItem = togglePalantirWatchlistItem;
window.exportPalantirBrief = exportPalantirBrief;

// ── Donut Chart ──
function renderPalantirDonut(violent, property, drug, other) {
  const svg = document.getElementById('palantir-donut');
  const legend = document.getElementById('palantir-donut-legend');
  if (!svg || !legend) return;

  const total = violent + property + drug + other;
  if (total === 0) {
    svg.innerHTML = '';
    legend.innerHTML = '<div style="color:var(--muted);font-family:var(--font-mono);font-size:9px;">No data</div>';
    return;
  }

  const segments = [
    { label: 'Violent', count: violent, color: '#ff1744' },
    { label: 'Property', count: property, color: '#2979ff' },
    { label: 'Drug', count: drug, color: '#00e676' },
    { label: 'Other', count: other, color: '#78909c' }
  ].filter(s => s.count > 0);

  const cx = 40, cy = 40, r = 28, strokeWidth = 12;
  const circumference = 2 * Math.PI * r;
  let offset = 0;

  let paths = '';
  segments.forEach(s => {
    const pct = s.count / total;
    const dashLen = pct * circumference;
    paths += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${strokeWidth}" stroke-dasharray="${dashLen} ${circumference - dashLen}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})" style="transition:stroke-dasharray 0.5s ease,stroke-dashoffset 0.5s ease;"/>`;
    offset += dashLen;
  });

  svg.innerHTML = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="${strokeWidth}"/>${paths}<text x="${cx}" y="${cy - 4}" text-anchor="middle" fill="var(--text)" font-family="var(--font-mono)" font-size="14" font-weight="700">${total.toLocaleString()}</text><text x="${cx}" y="${cy + 10}" text-anchor="middle" fill="var(--muted)" font-family="var(--font-mono)" font-size="7" letter-spacing="0.1em">TOTAL</text>`;

  legend.innerHTML = segments.map(s => `
    <div style="display:flex;align-items:center;gap:5px;font-family:var(--font-mono);font-size:9px;">
      <span style="width:8px;height:8px;border-radius:50%;background:${s.color};flex-shrink:0;"></span>
      <span style="color:var(--text);flex:1;">${s.label}</span>
      <span style="color:var(--muted);font-variant-numeric:tabular-nums;">${s.count}</span>
    </div>
  `).join('');
}

// ── Sparklines ──
function renderPalantirSparklines(crimes) {
  // Group crimes by day for last 7 days
  const now = new Date();
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push(key);
  }

  const countsByDay = { total: {}, Violent: {}, Property: {}, Drug: {} };
  days.forEach(d => { countsByDay.total[d] = 0; countsByDay.Violent[d] = 0; countsByDay.Property[d] = 0; countsByDay.Drug[d] = 0; });

  crimes.forEach(c => {
    if (!c.time) return;
    const key = c.time.slice(0, 10);
    if (countsByDay.total[key] !== undefined) {
      countsByDay.total[key]++;
      if (countsByDay[c.category]) countsByDay[c.category][key]++;
    }
  });

  drawSparkline('spark-total', days.map(d => countsByDay.total[d]), '#e8f4f8');
  drawSparkline('spark-violent', days.map(d => countsByDay.Violent[d]), '#ff1744');
  drawSparkline('spark-property', days.map(d => countsByDay.Property[d]), '#2979ff');
  drawSparkline('spark-drug', days.map(d => countsByDay.Drug[d]), '#00e676');
}

function drawSparkline(svgId, values, color) {
  const svg = document.getElementById(svgId);
  if (!svg) return;
  const w = 60, h = 24, pad = 2;
  const max = Math.max(...values, 1);
  const min = 0;
  const range = max - min || 1;
  const points = values.map((v, i) => {
    const x = pad + (i / (values.length - 1 || 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  }).join(' ');
  const areaPoints = points + ` ${pad + (w - pad * 2)},${h - pad} ${pad},${h - pad}`;
  svg.innerHTML = `
    <polygon points="${areaPoints}" fill="${color}" opacity="0.12"/>
    <polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round"/>
  `;
}