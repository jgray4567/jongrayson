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
  document.querySelectorAll('#palantir-category-filters .palantir-filter-chip').forEach(btn => {
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

  if (!drawer || !bodyEl) return;

  const color = PALANTIR_COLORS[crime.category] || '#78909c';
  const isWatchlisted = palantirWatchlist.some(w => w.lat === crime.lat && w.lng === crime.lng && w.time === crime.time);

  if (catEl) {
    catEl.style.background = color + '22';
    catEl.style.borderLeft = `3px solid ${color}`;
    catEl.style.color = color;
    catEl.textContent = crime.category;
  }
  if (titleEl) titleEl.textContent = crime.incident_type || 'Unknown Incident';

  // Find related incidents
  const related = findRelatedIncidents(crime);

  bodyEl.innerHTML = `
    <div class="palantir-drawer-section">
      <div class="palantir-drawer-section-title">Intelligence Summary</div>
      <div class="palantir-drawer-field"><span class="label">Type</span><span class="value">${crime.incident_type || 'N/A'}</span></div>
      <div class="palantir-drawer-field"><span class="label">Category</span><span class="value" style="color:${color}">${crime.category}</span></div>
      <div class="palantir-drawer-field"><span class="label">Zone</span><span class="value">${crime.zone || 'N/A'}</span></div>
      <div class="palantir-drawer-field"><span class="label">Coordinates</span><span class="value">${crime.lat?.toFixed(4)}, ${crime.lng?.toFixed(4)}</span></div>
      <div class="palantir-drawer-field"><span class="label">Time</span><span class="value">${crime.time || 'N/A'}</span></div>
      <div class="palantir-drawer-field"><span class="label">Severity</span><span class="value">${PALANTIR_SEVERITY[crime.category]?.toUpperCase() || 'LOW'}</span></div>
    </div>
    <div class="palantir-drawer-section">
      <div class="palantir-drawer-section-title">Temporal Pattern</div>
      <div class="palantir-drawer-field"><span class="label">Day</span><span class="value">${crime.time ? new Date(crime.time).toLocaleDateString('en-US', {weekday:'long'}) : 'N/A'}</span></div>
      <div class="palantir-drawer-field"><span class="label">Hour</span><span class="value">${crime.time ? new Date(crime.time).getHours() + ':00' : 'N/A'}</span></div>
    </div>
    <div class="palantir-drawer-section">
      <div class="palantir-drawer-section-title">Related Incidents (${related.length})</div>
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
      <div style="font-family:var(--font-mono);font-size:11px;color:var(--muted);line-height:1.5;">
        ${generateLeads(crime, related)}
      </div>
    </div>
    <div style="margin-top:12px;">
      <button onclick="togglePalantirWatchlistItem(${crime.lat},${crime.lng},'${crime.time?.replace(/'/g, "\\'") || ''}','${crime.incident_type?.replace(/'/g, "\\'") || ''}','${crime.category}')" 
        style="background:${isWatchlisted ? '#ffd60022' : 'rgba(255,255,255,0.04)'};border:1px solid ${isWatchlisted ? '#ffd600' : 'var(--border)'};color:${isWatchlisted ? '#ffd600' : 'var(--muted)'};padding:6px 12px;border-radius:3px;cursor:pointer;font-family:var(--font-mono);font-size:10px;width:100%;text-transform:uppercase;letter-spacing:0.06em;">
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

  // Draw stacked bars
  const barW = Math.max(1, (w - 4) / dates.length);
  const categories = ['Violent', 'Property', 'Drug', 'Other'];

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