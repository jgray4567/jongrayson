// ── Dynamic lazy-loaders for heavy dependencies ──
let _satelliteLoadPromise = null;
let _forceGraphLoadPromise = null;

async function ensureSatelliteLib() {
  if (window.satellite) return;
  if (!_satelliteLoadPromise) {
    _satelliteLoadPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://unpkg.com/satellite.js@5.0.0/dist/satellite.min.js';
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Failed to load satellite.js'));
      document.head.appendChild(s);
    });
  }
  await _satelliteLoadPromise;
}

async function ensureForceGraphLib() {
  if (window.ForceGraph || (typeof ForceGraph !== 'undefined')) return;
  if (!_forceGraphLoadPromise) {
    _forceGraphLoadPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://unpkg.com/force-graph';
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Failed to load force-graph'));
      document.head.appendChild(s);
    });
  }
  await _forceGraphLoadPromise;
}

const recommendationsList = document.getElementById('third-order-escalation-recommendations-list');
const analyticsList = document.getElementById('third-order-escalation-analytics-list');
const effectivenessList = document.getElementById('third-order-escalation-effectiveness-list');
let currentSourceFilter = null;
let currentSeverityFilter = null;
let currentTagFilter = null;
let currentTaskIdFilter = null;
let currentRecoveredFilter = false;
let currentFeedView = 'active';
let currentTimelineFilter = null;
let currentTimelineWindowMinutes = 60;
let currentTimelineViews = [];
let currentBaselineMode = 'previous';
let currentBaselineViewId = '';
let autoRefreshTimer = null;
let diagnosticsVisible = false;
let currentPriorityItems = [];

let currentGlobeBaseItems = [];
let currentGlobePointsData = [];
let cityMapInstance = null;
let pittsburghHeatLayer = null;
let pittsburghHeatVisible = true;
let pittsburghMarkersVisible = false;
let pittsburghZoneLayer = null;
let pittsburghZoneGeojsonData = null;
let pittsburghZoneStatsData = null;
let pittsburghZonesVisible = true;
let pittsburghCrimesData = [];
let pittsburghCrimesLayer = null;
let pittsburghDangerLayer = null;
let pittsburghDangerVisible = false;
let pittsburghSelectedMonth = null;
let pittsburghVisibleCategories = new Set(['Violent', 'Property', 'Drug', 'Other']);
let threatLayerEnabled = false;
let threatArcData = [];
let threatHotspots = [];

function isNightTime() {
  const hour = new Date().getHours();
  return hour >= 19 || hour < 6; // 7pm–6am
}

let mapHoverCard = null;
let mapHoverHideTimer = null;
let airLayerEnabled = false;
let currentAirTrafficItems = [];
const flightDetailCache = new Map();
let selectedAirIcao24 = null;
let selectedAirRegion = null;
let selectedAirCategory = null;
let hoveredCityLabel = null;
let hoveredCity = null;
let overlayFlightPaths = [];
let overlaySatelliteOrbits = [];
let overlayElements = [];
let satelliteLayerEnabled = false;
let seaLayerEnabled = false;
let currentVesselCatalog = [];
let seaLayerTimer = null;
let selectedSeaType = null;
let selectedSeaFlag = null;
let seaRegion = null;
let currentSatelliteCatalog = [];
let satelliteLayerTimer = null;
let selectedSatNetwork = null;
let selectedSatOrbit = null;
const visibleSatelliteOrbits = new Set(['LEO', 'MEO', 'GEO']);
const cityCrimeScans = {
  'Los Angeles Port': {
    center: [33.739, -118.262],
    zoom: 12,
    incidents: 68,
    hotspots: 4,
    points: [
      { lat: 33.743, lng: -118.268, intensity: 0.92, zone: 'Berth 46 Corridor', totals: { theft: 18, assault: 7, vandalism: 5, weapons: 3 } },
      { lat: 33.736, lng: -118.259, intensity: 0.81, zone: 'Harbor Gateway', totals: { theft: 12, assault: 6, trespass: 8, narcotics: 2 } },
      { lat: 33.731, lng: -118.251, intensity: 0.74, zone: 'Dockside Freight Spine', totals: { burglary: 9, theft: 11, vehicle: 4, assault: 3 } },
      { lat: 33.726, lng: -118.274, intensity: 0.64, zone: 'Outer Container Ring', totals: { theft: 8, trespass: 6, vandalism: 4, arson: 1 } },
      { lat: 33.747, lng: -118.246, intensity: 0.58, zone: 'North Access Roads', totals: { theft: 6, vehicle: 5, assault: 2, burglary: 3 } }
    ]
  },
  'NYC Datacenter': {
    center: [40.7128, -74.006],
    zoom: 12,
    incidents: 41,
    hotspots: 3,
    points: [
      { lat: 40.716, lng: -74.002, intensity: 0.78, zone: 'Canal Exchange', totals: { theft: 10, assault: 5, fraud: 4, burglary: 3 } },
      { lat: 40.709, lng: -74.011, intensity: 0.72, zone: 'Battery Transit Edge', totals: { theft: 7, robbery: 4, assault: 3, vehicle: 2 } },
      { lat: 40.721, lng: -73.998, intensity: 0.63, zone: 'Lower East Relay', totals: { burglary: 6, fraud: 5, theft: 4, assault: 2 } },
      { lat: 40.705, lng: -74.016, intensity: 0.54, zone: 'West Financial Grid', totals: { theft: 5, fraud: 3, trespass: 2, assault: 1 } }
    ]
  },
  'London HQ': {
    center: [51.5074, -0.1278],
    zoom: 12,
    incidents: 52,
    hotspots: 4,
    points: [
      { lat: 51.512, lng: -0.118, intensity: 0.84, zone: 'Covent Core', totals: { theft: 15, assault: 5, burglary: 4, narcotics: 2 } },
      { lat: 51.503, lng: -0.132, intensity: 0.76, zone: 'Westminster Flow', totals: { theft: 10, vandalism: 4, assault: 4, robbery: 3 } },
      { lat: 51.509, lng: -0.145, intensity: 0.68, zone: 'Mayfair Arc', totals: { theft: 8, burglary: 6, fraud: 3, assault: 2 } },
      { lat: 51.497, lng: -0.124, intensity: 0.59, zone: 'South Bank Fringe', totals: { theft: 7, assault: 3, vandalism: 3, trespass: 2 } }
    ]
  },
  'Tokyo AP-Northeast': {
    center: [35.6762, 139.6503],
    zoom: 12,
    incidents: 27,
    hotspots: 2,
    points: [
      { lat: 35.681, lng: 139.657, intensity: 0.62, zone: 'Shinjuku Exchange', totals: { theft: 7, assault: 2, fraud: 3, vandalism: 1 } },
      { lat: 35.671, lng: 139.643, intensity: 0.55, zone: 'Yoyogi Drift', totals: { theft: 5, assault: 2, trespass: 2, fraud: 2 } },
      { lat: 35.664, lng: 139.651, intensity: 0.48, zone: 'Shibuya Flow', totals: { theft: 4, vandalism: 2, assault: 1, fraud: 1 } }
    ]
  },
  'Pittsburgh, PA USA': {
    center: [40.4406, -79.9959],
    zoom: 12,
    incidents: 73,
    hotspots: 6,
    points: [
      { lat: 40.456, lng: -80.015, intensity: 0.77, zone: 'Zone 1 North Side', totals: { theft: 12, assault: 6, robbery: 4, narcotics: 3 } },
      { lat: 40.445, lng: -79.977, intensity: 0.69, zone: 'Zone 2 East End', totals: { theft: 10, burglary: 5, assault: 4, fraud: 3 } },
      { lat: 40.435, lng: -79.98, intensity: 0.71, zone: 'Zone 3 South Side', totals: { assault: 7, theft: 8, robbery: 4, vehicle: 2 } },
      { lat: 40.441, lng: -80.03, intensity: 0.63, zone: 'Zone 4 West End', totals: { theft: 7, burglary: 4, assault: 3, vandalism: 2 } },
      { lat: 40.466, lng: -79.93, intensity: 0.66, zone: 'Zone 5 Highland Park', totals: { theft: 9, fraud: 4, burglary: 4, assault: 2 } },
      { lat: 40.47, lng: -80.001, intensity: 0.58, zone: 'Zone 6 North Shore', totals: { theft: 6, assault: 3, vandalism: 2, trespass: 2 } }
    ]
  }
};

const dashboardCard = document.getElementById('third-order-escalation-dashboard-card');
const taskContextAnalyticsCard = document.getElementById('task-context-analytics-card');
const taskRetentionAnalyticsCard = document.getElementById('task-retention-analytics-card');
const taskSignalCorrelationCard = document.getElementById('task-signal-correlation-card');
const signalActionAnalyticsCard = document.getElementById('signal-action-analytics-card');
const signalRecoveryAnalyticsCard = document.getElementById('signal-recovery-analytics-card');
const signalEscalationAnalyticsList = document.getElementById('signal-escalation-analytics-list');
const timelineViewsList = document.getElementById('timeline-views-list');
const signalFeedList = document.getElementById('signal-feed-list');
const signalSeverityFilters = document.getElementById('signal-severity-filters');
const signalViewFilters = document.getElementById('signal-view-filters');
const selectedQuery = document.getElementById('selected-query');
const timelineContainer = document.getElementById('timeline-container');
const timelineFocusStatus = document.getElementById('timeline-focus-status');
const timelineFocusSummary = document.getElementById('timeline-focus-summary');
const timelineWindowButtons = document.getElementById('timeline-window-buttons');
const saveTimelineViewButton = document.getElementById('save-timeline-view');
const copyShareLinkButton = document.getElementById('copy-share-link');
const clearTimelineFilterButton = document.getElementById('clear-timeline-filter');
const feedWindowSummary = document.getElementById('feed-window-summary');
const timelineComparisonSummary = document.getElementById('timeline-comparison-summary');
const baselineShiftSummary = document.getElementById('baseline-shift-summary');
const baselineDriftHistory = document.getElementById('baseline-drift-history');
const baselinePerformanceSummary = document.getElementById('baseline-performance-summary');
const baselineTrendSummary = document.getElementById('baseline-trend-summary');
const baselineHistoryHealth = document.getElementById('baseline-history-health');
const baselineRecommendationActions = document.getElementById('baseline-recommendation-actions');
const baselineRecommendationAnalytics = document.getElementById('baseline-recommendation-analytics');
const baselineRecommendationEffectiveness = document.getElementById('baseline-recommendation-effectiveness');
const baselineRecommendationPriority = document.getElementById('baseline-recommendation-priority');
const baselineRecommendationOutcomes = document.getElementById('baseline-recommendation-outcomes');
const baselineRecommendationSuppressed = document.getElementById('baseline-recommendation-suppressed');
const baselineRecommendationRevived = document.getElementById('baseline-recommendation-revived');
const baselineRecommendationRevivalAnalytics = document.getElementById('baseline-recommendation-revival-analytics');
const baselineRecommendationChurn = document.getElementById('baseline-recommendation-churn');
const baselineRecommendationStable = document.getElementById('baseline-recommendation-stable');
const baselineRecommendationConfidence = document.getElementById('baseline-recommendation-confidence');
const baselineRecommendationConfidenceTrend = document.getElementById('baseline-recommendation-confidence-trend');
const baselineRecommendationConfidenceVolatility = document.getElementById('baseline-recommendation-confidence-volatility');
const baselineRecommendationConfidenceResilience = document.getElementById('baseline-recommendation-confidence-resilience');
const baselineRecommendationConfidenceAdjustments = document.getElementById('baseline-recommendation-confidence-adjustments');
const baselineRecommendationTrustMomentum = document.getElementById('baseline-recommendation-trust-momentum');
const baselineRecommendationPlaybook = document.getElementById('baseline-recommendation-playbook');
const baselineMaintenanceAnalytics = document.getElementById('baseline-maintenance-analytics');
const baselineMaintenanceEffectiveness = document.getElementById('baseline-maintenance-effectiveness');
const baselineModeSelect = document.getElementById('baseline-mode-select');
const baselineViewSelect = document.getElementById('baseline-view-select');
const selectedMeta = document.getElementById('selected-meta');
const overviewHeadline = document.getElementById('overview-headline');
const feedStatus = document.getElementById('feed-status');

const BASELINE_HISTORY_KEY = 'jk-intel-baseline-history-v1';

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json();
}

function buildShareUrl() {
  const url = new URL(window.location.href);
  const params = url.searchParams;

  if (currentTimelineFilter) params.set('time', currentTimelineFilter);
  else params.delete('time');

  if (Number(currentTimelineWindowMinutes) !== 60) params.set('window', String(currentTimelineWindowMinutes));
  else params.delete('window');

  if (currentSeverityFilter) params.set('severity', currentSeverityFilter);
  else params.delete('severity');

  if (currentSourceFilter) params.set('source', currentSourceFilter);
  else params.delete('source');

  if (currentRecoveredFilter) params.set('recovered', '1');
  else params.delete('recovered');

  if (currentFeedView && currentFeedView !== 'active') params.set('feedView', currentFeedView);
  else params.delete('feedView');

  if (currentBaselineMode && currentBaselineMode !== 'previous') params.set('baselineMode', currentBaselineMode);
  else params.delete('baselineMode');

  if (currentBaselineViewId) params.set('baselineView', currentBaselineViewId);
  else params.delete('baselineView');

  url.search = params.toString();
  return url.toString();
}

function syncUrlState() {
  if (typeof window === 'undefined') return;
  window.history.replaceState({}, '', buildShareUrl());
}

function initializeStateFromUrl() {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  currentTimelineFilter = params.get('time') || null;
  currentTimelineWindowMinutes = Math.max(1, Number(params.get('window') || currentTimelineWindowMinutes || 60));
  currentSeverityFilter = params.get('severity') || null;
  currentSourceFilter = params.get('source') || null;
  currentRecoveredFilter = params.get('recovered') === '1';
  currentFeedView = params.get('feedView') || currentFeedView || 'active';
  currentBaselineMode = params.get('baselineMode') || currentBaselineMode || 'previous';
  currentBaselineViewId = params.get('baselineView') || currentBaselineViewId || '';
}

function buildFeedParams(overrides = {}) {
  const params = new URLSearchParams();
  const source = overrides.source ?? currentSourceFilter;
  const severity = overrides.severity ?? currentSeverityFilter;
  const tag = overrides.tag ?? currentTagFilter;
  const taskId = overrides.taskId ?? currentTaskIdFilter;
  const recovered = overrides.recovered ?? currentRecoveredFilter;
  const time = overrides.time ?? currentTimelineFilter;
  const windowMinutes = overrides.windowMinutes ?? currentTimelineWindowMinutes;
  const feedView = overrides.feedView ?? currentFeedView;

  if (source) params.append('source', source);
  if (severity) params.append('severity', severity);
  if (tag) params.append('tag', tag);
  if (taskId) params.append('taskId', taskId);
  if (recovered) params.append('recovered', '1');
  if (time) params.append('time', time);
  if (time) params.append('windowMinutes', windowMinutes);
  params.append('view', feedView || 'active');
  return params;
}

function setSelected(item) {
  if (selectedQuery) selectedQuery.textContent = item?.suggestedQuery || 'No query selected';
  if (selectedMeta) selectedMeta.textContent = item
    ? `${item.topic} · ${item.thirdOrderEscalationAction || item.effectiveness || 'tracked'}`
    : 'Use the chips on the left to focus a recommendation case.';
}

function renderRecommendations(items = []) {
  if (recommendationsList) recommendationsList.innerHTML = items.map((item) => `
    <div class="filter-row">
      <button class="tag-chip" data-third-order-focus='${JSON.stringify(item).replace(/'/g, '&apos;')}'>${item.topic} · ${item.thirdOrderEscalationAction}</button>
      <button class="ghost-btn" data-third-order-review='${JSON.stringify(item).replace(/'/g, '&apos;')}'>Review</button>
    </div>
  `).join('') || '<div class="task-focus-meta">No third-order escalation recommendations right now.</div>';
}

function renderAnalytics(items = []) {
  if (analyticsList) analyticsList.innerHTML = items.map((item) => `
    <button class="tag-chip" data-third-order-analytics='${JSON.stringify(item).replace(/'/g, '&apos;')}'>${item.topic} · ${item.thirdOrderEscalationAcceptCount} accepts</button>
  `).join('') || '<div class="task-focus-meta">No third-order escalation accepts yet.</div>';
}

function renderEffectiveness(items = []) {
  if (effectivenessList) effectivenessList.innerHTML = items.map((item) => `
    <button class="tag-chip" data-third-order-effectiveness='${JSON.stringify(item).replace(/'/g, '&apos;')}'>${item.topic} · ${item.effectiveness} · ${item.effectivenessScore}</button>
  `).join('') || '<div class="task-focus-meta">No third-order escalation effectiveness scores yet.</div>';
}

function renderDashboard(summary = {}) {
  if (dashboardCard) dashboardCard.innerHTML = `
    <div class="task-focus-meta">${summary.escalationCaseCount || 0} escalation cases · ${summary.totalAccepts || 0} accepts</div>
    <div class="task-focus-meta">${summary.effectiveCount || 0} effective · ${summary.mixedCount || 0} mixed · ${summary.weakCount || 0} weak</div>
  `;
}

function renderTaskContextAnalytics(summary = {}) {
  const tagsHtml = (summary.tags || []).map(t => `<button class="tag-chip" data-task-tag='${t.tag}'>${t.tag} (${t.count})</button>`).join('');
  if (taskContextAnalyticsCard) taskContextAnalyticsCard.innerHTML = `
    <div class="task-focus-meta" style="margin-bottom:8px;">
      <span style="color:var(--text); font-weight:600;">${summary.activeTasks || 0}</span> active tasks
      · <span style="color:var(--text);">${summary.archivedTasks || 0}</span> archived
      · <span style="color:var(--text);">${summary.convertedFromSignals || 0}</span> from signals
    </div>
    <div class="filter-row" style="flex-wrap:wrap;">
      ${tagsHtml}
    </div>
  `;
}

function renderTaskRetentionAnalytics(summary = {}) {
  const itemsHtml = (summary.items || []).map(t => `<div class="task-focus-meta" style="margin-bottom:4px;">${t.tag}: ${t.name} (${t.lifespanDays}d)</div>`).join('');
  if (taskRetentionAnalyticsCard) taskRetentionAnalyticsCard.innerHTML = `
    <div class="task-focus-meta" style="margin-bottom:8px;">
      <span style="color:var(--text); font-weight:600;">${summary.averageLifespanDays || 0}</span> average days active
    </div>
    ${itemsHtml || '<div class="task-focus-meta">No archived tasks found.</div>'}
  `;
}

function renderTaskSignalCorrelation(summary = {}) {
  const itemsHtml = (summary.items || []).map(t => `
    <button class="tag-chip" data-task-focus-id='${t.id}' data-task-name='${t.name}' title="${t.name}">${t.tag} · ${t.signalsAttached} signals</button>
  `).join('');
  if (taskSignalCorrelationCard) taskSignalCorrelationCard.innerHTML = `
    <div class="task-focus-meta" style="margin-bottom:8px;">
      <span style="color:var(--text); font-weight:600;">${summary.averageSignalsPerTask || 0}</span> average signals per active task
    </div>
    <div class="filter-row" style="flex-wrap:wrap;">
      ${itemsHtml || '<div class="task-focus-meta">No active tasks with signals found.</div>'}
    </div>
  `;
}

function renderSignalActionAnalytics(summary = {}) {
  if (signalActionAnalyticsCard) signalActionAnalyticsCard.innerHTML = `
    <div class="task-focus-meta" style="margin-bottom:8px;">
      <span style="color:var(--text); font-weight:600;">${summary.active || 0}</span> unread active signals
    </div>
    <div class="filter-row">
      <span class="tag-chip">${summary.acknowledge || 0} ack</span>
      <span class="tag-chip">${summary.dismiss || 0} dis</span>
      <span class="tag-chip">${summary.escalate || 0} esc</span>
    </div>
  `;
}

function renderSignalRecoveryAnalytics(summary = {}) {
  const rate = Number(summary.recoveryRatePct || 0);
  const healthLabel = rate >= 35
    ? 'High restoration rate, operators may be dismissing signals too aggressively.'
    : rate >= 15
      ? 'Moderate restoration rate, review archive decisions for false dismissals.'
      : 'Low restoration rate, archive decisions look relatively stable.';

  if (signalRecoveryAnalyticsCard) signalRecoveryAnalyticsCard.innerHTML = `
    <button class="tag-chip ${currentRecoveredFilter ? 'active' : ''}" data-signal-recovered="true" style="text-align:left; width:100%;">
      <span style="color:var(--text); font-weight:600;">${summary.recoveryRatePct || 0}%</span> recovery rate
      · <span style="color:var(--text);">${summary.recoveredSignals || 0}/${summary.archivedSignals || 0}</span> archived signals restored
      <div class="task-focus-meta" style="margin-top:6px; text-transform:none; letter-spacing:normal;">${summary.totalRecoveries || 0} total recoveries · ${healthLabel}</div>
    </button>
  `;
}

function renderSignalEscalationAnalytics(items = []) {
  if (signalEscalationAnalyticsList) signalEscalationAnalyticsList.innerHTML = items.map(item => `
    <button class="tag-chip" data-signal-analytics='${item.source}'>${item.source} · Net ${item.netScore > 0 ? '+' : ''}${item.netScore} (${item.escalationCount})</button>
  `).join('') || '<div class="task-focus-meta">No signals escalated yet.</div>';
}

function formatClock(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatWindowLabel(minutes) {
  const mins = Number(minutes || 0);
  if (!mins) return 'window';
  if (mins < 60) return `${mins}m window`;
  const hours = mins / 60;
  return Number.isInteger(hours) ? `${hours}h window` : `${hours.toFixed(1)}h window`;
}

function syncTimelineWindowButtons() {
  if (!timelineWindowButtons) return;
  timelineWindowButtons.querySelectorAll('[data-window-minutes]').forEach((button) => {
    button.classList.toggle('active', Number(button.dataset.windowMinutes) === Number(currentTimelineWindowMinutes));
  });
}

function syncSeverityFilterButtons() {
  if (!signalSeverityFilters) return;
  signalSeverityFilters.querySelectorAll('[data-severity]').forEach((button) => {
    const value = button.dataset.severity === 'all' ? null : button.dataset.severity;
    button.classList.toggle('active', value === currentSeverityFilter || (!value && currentSeverityFilter === null));
  });
}

function syncFeedViewButtons() {
  if (!signalViewFilters) return;
  signalViewFilters.querySelectorAll('[data-feed-view]').forEach((button) => {
    button.classList.toggle('active', button.dataset.feedView === currentFeedView);
  });
}

function syncBaselineControls() {
  if (baselineModeSelect) baselineModeSelect.value = currentBaselineMode || 'previous';
  if (baselineViewSelect) baselineViewSelect.value = currentBaselineViewId || '';
}

function formatTimelineViewName(view) {
  if (view?.name) return view.name;
  if (view?.anchorTime) return `${formatClock(view.anchorTime)} · ${formatWindowLabel(view.windowMinutes || 60)}`;
  return 'Saved temporal view';
}

function renderBaselineViewOptions(items = []) {
  if (!baselineViewSelect) return;
  if (baselineViewSelect) baselineViewSelect.innerHTML = ['<option value="">Choose saved view</option>', ...items.map((view) => `
    <option value="${view.id}">${formatTimelineViewName(view)}</option>
  `)].join('');

  if (currentBaselineViewId && !items.some((view) => view.id === currentBaselineViewId)) {
    currentBaselineViewId = '';
  }

  syncBaselineControls();
}

function computeBaselineShiftStats(currentItems = [], previousItems = []) {
  const currentCount = currentItems.length;
  const previousCount = previousItems.length;
  const currentHigh = currentItems.filter((item) => item.severity === 'high').length;
  const previousHigh = previousItems.filter((item) => item.severity === 'high').length;
  const delta = currentCount - previousCount;
  const highDelta = currentHigh - previousHigh;
  const score = (delta * 2) + (highDelta * 3);

  let label = 'Steady';
  if (score >= 4) label = 'Escalating';
  else if (score <= -4) label = 'Cooling';

  return { currentCount, previousCount, currentHigh, previousHigh, delta, highDelta, score, label };
}

function readBaselineHistory() {
  try {
    const raw = window.localStorage.getItem(BASELINE_HISTORY_KEY);
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeBaselineHistory(items = []) {
  try {
    window.localStorage.setItem(BASELINE_HISTORY_KEY, JSON.stringify(items.slice(0, 12)));
  } catch {
    // ignore local storage failures
  }
}

async function fetchServerBaselineHistory() {
  try {
    const payload = await fetchJson('api/baseline-history.php');
    return Array.isArray(payload.items) ? payload.items : [];
  } catch {
    return null;
  }
}

async function persistBaselineHistoryServer(entry) {
  try {
    const payload = await fetchJson('api/baseline-history.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry)
    });
    return Array.isArray(payload.items) ? payload.items : null;
  } catch {
    return null;
  }
}

function renderBaselineHistory(items = readBaselineHistory()) {
  if (!baselineDriftHistory) return;
  if (baselineDriftHistory) baselineDriftHistory.innerHTML = items.map((item, index) => `
    <button class="tag-chip" data-baseline-history-index="${index}" style="display:block; width:100%; text-align:left; margin-bottom:8px;">
      ${item.label} · ${item.score > 0 ? '+' : ''}${item.score}
      <div class="task-focus-meta" style="margin-top:6px; text-transform:none; letter-spacing:normal;">${item.baselineLabel} · ${formatClock(item.anchorTime)} · ${formatWindowLabel(item.windowMinutes)}</div>
    </button>
  `).join('') || 'Recent scored baseline comparisons will appear here.';
}

function renderBaselinePerformance(summary = {}) {
  if (!baselinePerformanceSummary) return;
  if (baselinePerformanceSummary) baselinePerformanceSummary.innerHTML = `
    <div><span style="color:var(--text); font-weight:600;">${summary.totalComparisons || 0}</span> server-side comparisons tracked</div>
    <div style="margin-top:8px;">Average score: <span style="color:var(--text); font-weight:600;">${summary.averageScore || 0}</span> · dominant state: <span style="color:var(--text); font-weight:600;">${summary.topBaselineLabel || 'n/a'}</span></div>
    <div style="margin-top:8px;">Escalating ${summary.escalatingCount || 0} · Steady ${summary.steadyCount || 0} · Cooling ${summary.coolingCount || 0}</div>
    <div style="margin-top:8px;">Saved-view baselines ${summary.savedBaselineCount || 0} · Previous-window baselines ${summary.previousBaselineCount || 0}</div>
  `;
}

function renderBaselineTrend(summary = {}) {
  if (!baselineTrendSummary) return;
  if (baselineTrendSummary) baselineTrendSummary.innerHTML = `
    <div><span style="color:var(--text); font-weight:600;">${summary.trend || 'steady'}</span> performance trend</div>
    <div style="margin-top:8px;">Recent avg: <span style="color:var(--text); font-weight:600;">${summary.recentAverageScore || 0}</span> vs prior avg: <span style="color:var(--text); font-weight:600;">${summary.priorAverageScore || 0}</span></div>
    <div style="margin-top:8px;">Drift: <span style="color:var(--text); font-weight:600;">${summary.drift > 0 ? '+' : ''}${summary.drift || 0}</span> · latest label: ${summary.latestLabel || 'n/a'}</div>
    <div style="margin-top:8px;">Recent window count ${summary.recentCount || 0} · prior window count ${summary.priorCount || 0}</div>
  `;
}

function renderBaselineHistoryHealth(summary = {}) {
  if (!baselineHistoryHealth) return;
  const suggestions = (summary.items || []).map((item) => `
    <button class="tag-chip" data-history-health-action="${item.action}" style="display:block; width:100%; text-align:left; margin-top:8px;">
      ${item.action}
      <div class="task-focus-meta" style="margin-top:6px; text-transform:none; letter-spacing:normal;">${item.reason}</div>
    </button>
  `).join('');

  if (baselineHistoryHealth) baselineHistoryHealth.innerHTML = `
    <div><span style="color:var(--text); font-weight:600;">${summary.totalEntries || 0}</span> entries · ${summary.steadyEntries || 0} steady · ${summary.savedBaselineEntries || 0} saved-baseline · ${summary.staleEntries || 0} stale</div>
    ${suggestions}
  `;
}

function renderBaselineRecommendations(items = []) {
  if (!baselineRecommendationActions) return;
  if (baselineRecommendationActions) baselineRecommendationActions.innerHTML = items.map((item) => `
    <button class="tag-chip" data-baseline-recommendation="${item.action}" style="display:block; width:100%; text-align:left; margin-bottom:8px;">
      ${item.action}${item.promotion ? ` · ${item.promotion}` : ''}
      <div class="task-focus-meta" style="margin-top:6px; text-transform:none; letter-spacing:normal;">${item.reason}${item.priorityScore !== undefined ? ` · score ${item.priorityScore}` : ''}${item.confidenceBand ? ` · confidence ${item.confidenceBand}${item.baseConfidenceBand && item.baseConfidenceBand !== item.confidenceBand ? ` (from ${item.baseConfidenceBand})` : ''}` : ''}${item.resilienceBand ? ` · resilience ${item.resilienceBand} ${item.resilienceScore || 0}` : ''}${item.confidenceReason ? ` · why ${item.confidenceReason}` : ''}${item.outcomeScore !== undefined ? ` · outcome ${item.outcomeScore}` : ''}${item.playbookConfidence && item.playbookConfidence !== 'none' ? ` · playbook ${item.playbookConfidence}+${item.playbookBoost || 0}${item.freshness ? ` (${item.freshness})` : ''}` : ''}${item.revivalStatus ? ` · revival ${item.revivalStatus}${item.revivalBoost ? `${item.revivalBoost > 0 ? '+' : ''}${item.revivalBoost}` : ''}` : ''}${item.changeCount ? ` · churn ${item.changeCount}${item.churnPenalty ? ` (${item.churnPenalty})` : ''}` : ''}${item.stableBoost ? ` · stability ${item.stabilityState}+${item.stableBoost}` : ''}${item.volatilityPenalty || item.volatilityBoost ? ` · volatility ${item.volatilityState}${item.volatilityBoost ? `+${item.volatilityBoost}` : ''}${item.volatilityPenalty ? `${item.volatilityPenalty}` : ''}` : ''}${item.upgradeConfirmationBoost ? ` · upgrades ${item.upgradedCount || 0} (+${item.upgradeConfirmationBoost})` : ''}${item.upgradeDowngradePenalty ? ` · downgrades ${item.downgradedCount || 0} (${item.upgradeDowngradePenalty})` : ''}${item.trustMomentumAdjustment ? ` · momentum ${item.trustMomentumBand || 'neutral'} ${item.trustMomentumScore || 0} (${item.trustMomentumAdjustment > 0 ? '+' : ''}${item.trustMomentumAdjustment})` : ''}${item.trustMomentumJustReversed ? ` · reversal ${item.trustMomentumBand || 'neutral'}${item.trustMomentumReversalAdjustment ? ` (${item.trustMomentumReversalAdjustment > 0 ? '+' : ''}${item.trustMomentumReversalAdjustment})` : ''}` : ''}${item.trustMomentumReversalStreak ? ` · streak ${item.trustMomentumReversalStreak}${item.trustMomentumReversalStreakAdjustment ? ` (${item.trustMomentumReversalStreakAdjustment})` : ''}` : ''}${item.trustMomentumStabilityStreak ? ` · stable ${item.trustMomentumStabilityStreak}${item.trustMomentumStabilityBoost ? ` (+${item.trustMomentumStabilityBoost})` : ''}` : ''}${item.convergenceStreak ? ` · convergence ${item.convergenceStreak}${item.convergenceBoost ? ` (+${item.convergenceBoost})` : ''}` : ''}${item.justConverged ? ' · just converged' : ''}${item.dependencyStreak ? ` · dependent ${item.dependencyStreak}${item.dependencyPenalty ? ` (${item.dependencyPenalty})` : ''}` : ''}${item.justBecameDependent ? ' · just dependent' : ''}${item.dependencyRecoveryStreak ? ` · recovery ${item.dependencyRecoveryStreak}${item.dependencyRecoveryBoost ? ` (+${item.dependencyRecoveryBoost})` : ''}` : ''}${item.justRecoveredFromDependency ? ' · just recovered' : ''}${item.dependencyRecoveryDurability && item.dependencyRecoveryDurability !== 'fragile' ? ` · recovery ${item.dependencyRecoveryDurability}${item.dependencyRecoveryDurabilityBoost ? ` (+${item.dependencyRecoveryDurabilityBoost})` : ''}` : ''}${item.justBecameDurableRecovery ? ' · just durable' : ''}${item.justRelapsedFromDurableRecovery ? ` · relapse (${item.durableRecoveryRelapsePenalty || 0})` : ''}${item.relapseResilienceBand && item.relapseResilienceBand !== 'neutral' ? ` · relapse ${item.relapseResilienceBand} ${item.relapseResilienceScore || 0} (${item.relapseResilienceAdjustment > 0 ? '+' : ''}${item.relapseResilienceAdjustment || 0})` : ''}${item.recoveryMaturityBand && item.recoveryMaturityBand !== 'early' ? ` · recovery ${item.recoveryMaturityBand} ${item.recoveryMaturityScore || 0} (${item.recoveryMaturityAdjustment > 0 ? '+' : ''}${item.recoveryMaturityAdjustment || 0})` : ''}${item.recoveryMaturityDrift && item.recoveryMaturityDrift !== 'steady' ? ` · maturity ${item.recoveryMaturityDrift}${item.recoveryMaturityDelta ? ` (${item.recoveryMaturityDelta > 0 ? '+' : ''}${item.recoveryMaturityDelta})` : ''}${item.recoveryMaturityDriftAdjustment ? ` (${item.recoveryMaturityDriftAdjustment > 0 ? '+' : ''}${item.recoveryMaturityDriftAdjustment})` : ''}` : ''}${item.recoveryMaturityJustReversed ? ` · reversal ${item.recoveryMaturityDrift}${item.recoveryMaturityReversalAdjustment ? ` (${item.recoveryMaturityReversalAdjustment})` : ''}` : ''}${item.recoveryMaturityReversalStreak ? ` · whipsaw ${item.recoveryMaturityReversalStreak}${item.recoveryMaturityReversalStreakAdjustment ? ` (${item.recoveryMaturityReversalStreakAdjustment})` : ''}` : ''}${item.recoveryMaturityStabilityStreak ? ` · stable ${item.recoveryMaturityStabilityStreak}${item.recoveryMaturityStabilityBoost ? ` (+${item.recoveryMaturityStabilityBoost})` : ''}` : ''}${item.recoveryMaturityBreakdownRiskBand && item.recoveryMaturityBreakdownRiskBand !== 'low' ? ` · risk ${item.recoveryMaturityBreakdownRiskBand} ${item.recoveryMaturityBreakdownRiskScore || 0} (${item.recoveryMaturityBreakdownRiskAdjustment || 0})` : ''}${item.recoveryTrustHealthBand ? ` · health ${item.recoveryTrustHealthBand} ${item.recoveryTrustHealthScore || 0} (${item.recoveryTrustHealthAdjustment > 0 ? '+' : ''}${item.recoveryTrustHealthAdjustment || 0})` : ''}${item.recoveryTrustHealthTrend && item.recoveryTrustHealthTrend !== 'steady' ? ` · health ${item.recoveryTrustHealthTrend}${item.recoveryTrustHealthDelta ? ` (${item.recoveryTrustHealthDelta > 0 ? '+' : ''}${item.recoveryTrustHealthDelta})` : ''}${item.recoveryTrustHealthTrendAdjustment ? ` (${item.recoveryTrustHealthTrendAdjustment > 0 ? '+' : ''}${item.recoveryTrustHealthTrendAdjustment})` : ''}` : ''}${item.recoveryTrustHealthJustReversed ? ` · health reversal ${item.recoveryTrustHealthTrend}${item.recoveryTrustHealthReversalAdjustment ? ` (${item.recoveryTrustHealthReversalAdjustment})` : ''}` : ''}${item.recoveryTrustHealthReversalStreak ? ` · health whipsaw ${item.recoveryTrustHealthReversalStreak}${item.recoveryTrustHealthReversalStreakAdjustment ? ` (${item.recoveryTrustHealthReversalStreakAdjustment})` : ''}` : ''}${item.recoveryTrustAdjustmentSummary ? ` · recovery stack ${item.recoveryTrustAdjustmentSummary}${item.recoveryTrustNetAdjustment ? ` · net ${item.recoveryTrustNetAdjustment > 0 ? '+' : ''}${item.recoveryTrustNetAdjustment}` : ''}` : ''}${item.recoveryTrustDriverJustShifted ? ` · driver shift ${item.previousRecoveryTrustTopDriver || 'none'} → ${item.recoveryTrustTopDriver || 'none'}${item.recoveryTrustDriverShiftAdjustment ? ` (${item.recoveryTrustDriverShiftAdjustment})` : ''}${item.recoveryTrustDriverTransitionSeverityBand && item.recoveryTrustDriverTransitionSeverityBand !== 'neutral' ? ` · ${item.recoveryTrustDriverTransitionSeverityBand}${item.recoveryTrustDriverTransitionAdjustment ? ` (${item.recoveryTrustDriverTransitionAdjustment > 0 ? '+' : ''}${item.recoveryTrustDriverTransitionAdjustment})` : ''}` : ''}` : ''}${item.recoveryTrustDriverShiftStreak ? ` · driver churn ${item.recoveryTrustDriverShiftStreak}${item.recoveryTrustDriverShiftStreakAdjustment ? ` (${item.recoveryTrustDriverShiftStreakAdjustment})` : ''}` : ''}${item.recoveryTrustDriverNegativeTransitionStreak ? ` · deterioration streak ${item.recoveryTrustDriverNegativeTransitionStreak}${item.recoveryTrustDriverNegativeTransitionStreakAdjustment ? ` (${item.recoveryTrustDriverNegativeTransitionStreakAdjustment})` : ''}` : ''}${item.recoveryTrustDriverPositiveTransitionStreak ? ` · recovery streak ${item.recoveryTrustDriverPositiveTransitionStreak}${item.recoveryTrustDriverPositiveTransitionStreakBoost ? ` (+${item.recoveryTrustDriverPositiveTransitionStreakBoost})` : ''}` : ''}${item.recoveryTrustDriverTransitionBalanceScore ? ` · transition balance ${item.recoveryTrustDriverTransitionBalanceBand || 'balanced'} ${item.recoveryTrustDriverTransitionBalanceScore > 0 ? '+' : ''}${item.recoveryTrustDriverTransitionBalanceScore}${item.recoveryTrustDriverTransitionBalanceAdjustment ? ` (${item.recoveryTrustDriverTransitionBalanceAdjustment > 0 ? '+' : ''}${item.recoveryTrustDriverTransitionBalanceAdjustment})` : ''}` : ''}${item.recoveryTrustDriverTransitionBalanceJustReversed ? ` · balance reversal ${item.previousRecoveryTrustDriverTransitionBalanceBand || 'balanced'} → ${item.recoveryTrustDriverTransitionBalanceBand || 'balanced'}${item.recoveryTrustDriverTransitionBalanceReversalAdjustment ? ` (${item.recoveryTrustDriverTransitionBalanceReversalAdjustment > 0 ? '+' : ''}${item.recoveryTrustDriverTransitionBalanceReversalAdjustment})` : ''}` : ''}${item.recoveryTrustDriverTransitionBalanceReversalStreak ? ` · balance whipsaw ${item.recoveryTrustDriverTransitionBalanceReversalStreak}${item.recoveryTrustDriverTransitionBalanceReversalStreakAdjustment ? ` (${item.recoveryTrustDriverTransitionBalanceReversalStreakAdjustment})` : ''}` : ''}${item.recoveryTrustDriverTransitionBalanceStabilityStreak ? ` · balance stable ${item.recoveryTrustDriverTransitionBalanceStabilityPolarity || 'neutral'} ${item.recoveryTrustDriverTransitionBalanceStabilityStreak}${item.recoveryTrustDriverTransitionBalanceStabilityAdjustment ? ` (${item.recoveryTrustDriverTransitionBalanceStabilityAdjustment > 0 ? '+' : ''}${item.recoveryTrustDriverTransitionBalanceStabilityAdjustment})` : ''}` : ''}${item.recoveryTrustDriverTransitionBalanceEntrenchmentBand && item.recoveryTrustDriverTransitionBalanceEntrenchmentBand !== 'none' ? ` · entrenchment ${item.recoveryTrustDriverTransitionBalanceEntrenchmentBand}${item.recoveryTrustDriverTransitionBalanceEntrenchmentAdjustment ? ` (${item.recoveryTrustDriverTransitionBalanceEntrenchmentAdjustment > 0 ? '+' : ''}${item.recoveryTrustDriverTransitionBalanceEntrenchmentAdjustment})` : ''}` : ''}${item.recoveryTrustDriverTransitionBalanceEscapedEntrenchment ? ` · entrenchment escape ${item.recoveryTrustDriverTransitionBalanceEntrenchmentEscapeDirection}${item.recoveryTrustDriverTransitionBalanceEntrenchmentEscapeAdjustment ? ` (${item.recoveryTrustDriverTransitionBalanceEntrenchmentEscapeAdjustment > 0 ? '+' : ''}${item.recoveryTrustDriverTransitionBalanceEntrenchmentEscapeAdjustment})` : ''}` : ''}${item.recoveryTrustDriverTransitionBalanceEscapedEntrenchmentDurably ? ` · escape durable ${item.recoveryTrustDriverTransitionBalanceEscapeDurabilityDirection} ${item.recoveryTrustDriverTransitionBalanceEscapeDurabilityStreak}${item.recoveryTrustDriverTransitionBalanceEscapeDurabilityAdjustment ? ` (${item.recoveryTrustDriverTransitionBalanceEscapeDurabilityAdjustment > 0 ? '+' : ''}${item.recoveryTrustDriverTransitionBalanceEscapeDurabilityAdjustment})` : ''}` : ''}${item.recoveryTrustDriverTransitionBalanceRecapturedEntrenchment ? ` · recaptured ${item.recoveryTrustDriverTransitionBalanceRecaptureDirection}${item.recoveryTrustDriverTransitionBalanceRecaptureAdjustment ? ` (${item.recoveryTrustDriverTransitionBalanceRecaptureAdjustment > 0 ? '+' : ''}${item.recoveryTrustDriverTransitionBalanceRecaptureAdjustment})` : ''}` : ''}${item.recoveryTrustDriverTransitionBalanceRecaptureStreak ? ` · recapture streak ${item.recoveryTrustDriverTransitionBalanceRecaptureStreak}${item.recoveryTrustDriverTransitionBalanceRecaptureStreakAdjustment ? ` (${item.recoveryTrustDriverTransitionBalanceRecaptureStreakAdjustment > 0 ? '+' : ''}${item.recoveryTrustDriverTransitionBalanceRecaptureStreakAdjustment})` : ''}` : ''}${item.recoveryTrustDriverTransitionBalanceStructuralState && item.recoveryTrustDriverTransitionBalanceStructuralState !== 'neutral' ? ` · structural state ${item.recoveryTrustDriverTransitionBalanceStructuralState}${item.recoveryTrustDriverTransitionBalanceStructuralAdjustment ? ` (${item.recoveryTrustDriverTransitionBalanceStructuralAdjustment > 0 ? '+' : ''}${item.recoveryTrustDriverTransitionBalanceStructuralAdjustment})` : ''}` : ''}</div>
    </button>
  `).join('') || 'No recommendation actions right now.';
}

function renderBaselineRecommendationAnalytics(items = []) {
  if (!baselineRecommendationAnalytics) return;
  if (baselineRecommendationAnalytics) baselineRecommendationAnalytics.innerHTML = items.map((item) => `
    <div style="margin-top:8px;"><span style="color:var(--text); font-weight:600;">${item.action}</span> · ${item.acceptedCount || 0} accepts · ${item.surfacedCount || 0} surfaced</div>
  `).join('') || 'No recommendation accepts yet.';
}

function renderBaselineRecommendationEffectiveness(summary = {}) {
  if (!baselineRecommendationEffectiveness) return;
  const items = summary.items || [];
  if (baselineRecommendationEffectiveness) baselineRecommendationEffectiveness.innerHTML = `
    <div><span style="color:var(--text); font-weight:600;">${summary.totalAccepted || 0}</span> accepts across <span style="color:var(--text); font-weight:600;">${summary.totalSurfaced || 0}</span> surfaces</div>
    <div style="margin-top:8px;">Overall acceptance rate: <span style="color:var(--text); font-weight:600;">${summary.overallAcceptanceRate || 0}</span></div>
    ${items.map((item) => `<div style="margin-top:8px;"><span style="color:var(--text); font-weight:600;">${item.action}</span> · ${item.effectiveness} · rate ${item.acceptanceRate || 0}</div>`).join('') || '<div style="margin-top:8px;">No recommendation effectiveness data yet.</div>'}
  `;
}

function renderBaselineRecommendationPriority(summary = {}) {
  if (!baselineRecommendationPriority) return;
  if (baselineRecommendationPriority) baselineRecommendationPriority.innerHTML = summary.topAction
    ? `<div><span style="color:var(--text); font-weight:600;">${summary.topAction}</span> · ${summary.topPromotion || 'default'} · score ${summary.topPriorityScore || 0}${summary.topConfidenceBand ? ` · confidence ${summary.topConfidenceBand}` : ''}${summary.topResilienceBand ? ` · resilience ${summary.topResilienceBand} ${summary.topResilienceScore || 0}` : ''}${summary.topConfidenceTrend ? ` · trend ${summary.topConfidenceTrend}${summary.topConfidenceDelta ? ` (${summary.topConfidenceDelta > 0 ? '+' : ''}${summary.topConfidenceDelta})` : ''}` : ''}${summary.topConfidenceReason ? ` · why ${summary.topConfidenceReason}` : ''}${summary.topOutcomeScore !== undefined ? ` · outcome ${summary.topOutcomeScore}` : ''}${summary.topPlaybookConfidence && summary.topPlaybookConfidence !== 'none' ? ` · playbook ${summary.topPlaybookConfidence}+${summary.topPlaybookBoost || 0}` : ''}${summary.topRevivalStatus ? ` · revival ${summary.topRevivalStatus}${summary.topRevivalBoost ? `${summary.topRevivalBoost > 0 ? '+' : ''}${summary.topRevivalBoost}` : ''}` : ''}${summary.topChangeCount ? ` · churn ${summary.topChangeCount}${summary.topChurnPenalty ? ` (${summary.topChurnPenalty})` : ''}` : ''}${summary.topStableBoost ? ` · stability ${summary.topStabilityState}+${summary.topStableBoost}` : ''}${summary.topVolatilityPenalty || summary.topVolatilityBoost ? ` · volatility ${summary.topVolatilityState}${summary.topVolatilityBoost ? `+${summary.topVolatilityBoost}` : ''}${summary.topVolatilityPenalty ? `${summary.topVolatilityPenalty}` : ''}` : ''}${summary.topUpgradeConfirmationBoost ? ` · upgrades ${summary.topUpgradedCount || 0} (+${summary.topUpgradeConfirmationBoost})` : ''}${summary.topUpgradeDowngradePenalty ? ` · downgrades ${summary.topDowngradedCount || 0} (${summary.topUpgradeDowngradePenalty})` : ''}${summary.topTrustMomentumAdjustment ? ` · momentum ${summary.topTrustMomentumBand || 'neutral'} ${summary.topTrustMomentumScore || 0} (${summary.topTrustMomentumAdjustment > 0 ? '+' : ''}${summary.topTrustMomentumAdjustment})` : ''}${summary.topTrustMomentumJustReversed ? ` · reversal ${summary.topTrustMomentumBand || 'neutral'}${summary.topTrustMomentumReversalAdjustment ? ` (${summary.topTrustMomentumReversalAdjustment > 0 ? '+' : ''}${summary.topTrustMomentumReversalAdjustment})` : ''}` : ''}${summary.topTrustMomentumReversalStreak ? ` · streak ${summary.topTrustMomentumReversalStreak}${summary.topTrustMomentumReversalStreakAdjustment ? ` (${summary.topTrustMomentumReversalStreakAdjustment})` : ''}` : ''}${summary.topTrustMomentumStabilityStreak ? ` · stable ${summary.topTrustMomentumStabilityStreak}${summary.topTrustMomentumStabilityBoost ? ` (+${summary.topTrustMomentumStabilityBoost})` : ''}` : ''}${summary.topConvergenceStreak ? ` · convergence ${summary.topConvergenceStreak}${summary.topConvergenceBoost ? ` (+${summary.topConvergenceBoost})` : ''}` : ''}${summary.topJustConverged ? ' · just converged' : ''}${summary.topDependencyStreak ? ` · dependent ${summary.topDependencyStreak}${summary.topDependencyPenalty ? ` (${summary.topDependencyPenalty})` : ''}` : ''}${summary.topJustBecameDependent ? ' · just dependent' : ''}${summary.topDependencyRecoveryStreak ? ` · recovery ${summary.topDependencyRecoveryStreak}${summary.topDependencyRecoveryBoost ? ` (+${summary.topDependencyRecoveryBoost})` : ''}` : ''}${summary.topJustRecoveredFromDependency ? ' · just recovered' : ''}${summary.topDependencyRecoveryDurability && summary.topDependencyRecoveryDurability !== 'fragile' ? ` · recovery ${summary.topDependencyRecoveryDurability}${summary.topDependencyRecoveryDurabilityBoost ? ` (+${summary.topDependencyRecoveryDurabilityBoost})` : ''}` : ''}${summary.topJustBecameDurableRecovery ? ' · just durable' : ''}${summary.topJustRelapsedFromDurableRecovery ? ` · relapse (${summary.topDurableRecoveryRelapsePenalty || 0})` : ''}${summary.topRelapseResilienceBand && summary.topRelapseResilienceBand !== 'neutral' ? ` · relapse ${summary.topRelapseResilienceBand} ${summary.topRelapseResilienceScore || 0} (${summary.topRelapseResilienceAdjustment > 0 ? '+' : ''}${summary.topRelapseResilienceAdjustment || 0})` : ''}${summary.topRecoveryMaturityBand && summary.topRecoveryMaturityBand !== 'early' ? ` · recovery ${summary.topRecoveryMaturityBand} ${summary.topRecoveryMaturityScore || 0} (${summary.topRecoveryMaturityAdjustment > 0 ? '+' : ''}${summary.topRecoveryMaturityAdjustment || 0})` : ''}${summary.topRecoveryMaturityDrift && summary.topRecoveryMaturityDrift !== 'steady' ? ` · maturity ${summary.topRecoveryMaturityDrift}${summary.topRecoveryMaturityDelta ? ` (${summary.topRecoveryMaturityDelta > 0 ? '+' : ''}${summary.topRecoveryMaturityDelta})` : ''}${summary.topRecoveryMaturityDriftAdjustment ? ` (${summary.topRecoveryMaturityDriftAdjustment > 0 ? '+' : ''}${summary.topRecoveryMaturityDriftAdjustment})` : ''}` : ''}${summary.topRecoveryMaturityJustReversed ? ` · reversal ${summary.topRecoveryMaturityDrift}${summary.topRecoveryMaturityReversalAdjustment ? ` (${summary.topRecoveryMaturityReversalAdjustment})` : ''}` : ''}${summary.topRecoveryMaturityReversalStreak ? ` · whipsaw ${summary.topRecoveryMaturityReversalStreak}${summary.topRecoveryMaturityReversalStreakAdjustment ? ` (${summary.topRecoveryMaturityReversalStreakAdjustment})` : ''}` : ''}${summary.topRecoveryMaturityStabilityStreak ? ` · stable ${summary.topRecoveryMaturityStabilityStreak}${summary.topRecoveryMaturityStabilityBoost ? ` (+${summary.topRecoveryMaturityStabilityBoost})` : ''}` : ''}${summary.topRecoveryMaturityBreakdownRiskBand && summary.topRecoveryMaturityBreakdownRiskBand !== 'low' ? ` · risk ${summary.topRecoveryMaturityBreakdownRiskBand} ${summary.topRecoveryMaturityBreakdownRiskScore || 0} (${summary.topRecoveryMaturityBreakdownRiskAdjustment || 0})` : ''}${summary.topRecoveryTrustHealthBand ? ` · health ${summary.topRecoveryTrustHealthBand} ${summary.topRecoveryTrustHealthScore || 0} (${summary.topRecoveryTrustHealthAdjustment > 0 ? '+' : ''}${summary.topRecoveryTrustHealthAdjustment || 0})` : ''}${summary.topRecoveryTrustHealthTrend && summary.topRecoveryTrustHealthTrend !== 'steady' ? ` · health ${summary.topRecoveryTrustHealthTrend}${summary.topRecoveryTrustHealthDelta ? ` (${summary.topRecoveryTrustHealthDelta > 0 ? '+' : ''}${summary.topRecoveryTrustHealthDelta})` : ''}${summary.topRecoveryTrustHealthTrendAdjustment ? ` (${summary.topRecoveryTrustHealthTrendAdjustment > 0 ? '+' : ''}${summary.topRecoveryTrustHealthTrendAdjustment})` : ''}` : ''}${summary.topRecoveryTrustHealthJustReversed ? ` · health reversal ${summary.topRecoveryTrustHealthTrend}${summary.topRecoveryTrustHealthReversalAdjustment ? ` (${summary.topRecoveryTrustHealthReversalAdjustment})` : ''}` : ''}${summary.topRecoveryTrustHealthReversalStreak ? ` · health whipsaw ${summary.topRecoveryTrustHealthReversalStreak}${summary.topRecoveryTrustHealthReversalStreakAdjustment ? ` (${summary.topRecoveryTrustHealthReversalStreakAdjustment})` : ''}` : ''}${summary.topRecoveryTrustAdjustmentSummary ? ` · recovery stack ${summary.topRecoveryTrustAdjustmentSummary}${summary.topRecoveryTrustNetAdjustment ? ` · net ${summary.topRecoveryTrustNetAdjustment > 0 ? '+' : ''}${summary.topRecoveryTrustNetAdjustment}` : ''}` : ''}${summary.topRecoveryTrustDriverJustShifted ? ` · driver shift ${summary.topPreviousRecoveryTrustTopDriver || 'none'} → ${summary.topRecoveryTrustTopDriver || 'none'}${summary.topRecoveryTrustDriverShiftAdjustment ? ` (${summary.topRecoveryTrustDriverShiftAdjustment})` : ''}${summary.topRecoveryTrustDriverTransitionSeverityBand && summary.topRecoveryTrustDriverTransitionSeverityBand !== 'neutral' ? ` · ${summary.topRecoveryTrustDriverTransitionSeverityBand}${summary.topRecoveryTrustDriverTransitionAdjustment ? ` (${summary.topRecoveryTrustDriverTransitionAdjustment > 0 ? '+' : ''}${summary.topRecoveryTrustDriverTransitionAdjustment})` : ''}` : ''}` : ''}${summary.topRecoveryTrustDriverShiftStreak ? ` · driver churn ${summary.topRecoveryTrustDriverShiftStreak}${summary.topRecoveryTrustDriverShiftStreakAdjustment ? ` (${summary.topRecoveryTrustDriverShiftStreakAdjustment})` : ''}` : ''}${summary.topRecoveryTrustDriverNegativeTransitionStreak ? ` · deterioration streak ${summary.topRecoveryTrustDriverNegativeTransitionStreak}${summary.topRecoveryTrustDriverNegativeTransitionStreakAdjustment ? ` (${summary.topRecoveryTrustDriverNegativeTransitionStreakAdjustment})` : ''}` : ''}${summary.topRecoveryTrustDriverPositiveTransitionStreak ? ` · recovery streak ${summary.topRecoveryTrustDriverPositiveTransitionStreak}${summary.topRecoveryTrustDriverPositiveTransitionStreakBoost ? ` (+${summary.topRecoveryTrustDriverPositiveTransitionStreakBoost})` : ''}` : ''}${summary.topRecoveryTrustDriverTransitionBalanceScore ? ` · transition balance ${summary.topRecoveryTrustDriverTransitionBalanceBand || 'balanced'} ${summary.topRecoveryTrustDriverTransitionBalanceScore > 0 ? '+' : ''}${summary.topRecoveryTrustDriverTransitionBalanceScore}${summary.topRecoveryTrustDriverTransitionBalanceAdjustment ? ` (${summary.topRecoveryTrustDriverTransitionBalanceAdjustment > 0 ? '+' : ''}${summary.topRecoveryTrustDriverTransitionBalanceAdjustment})` : ''}` : ''}${summary.topRecoveryTrustDriverTransitionBalanceJustReversed ? ` · balance reversal ${summary.topPreviousRecoveryTrustDriverTransitionBalanceBand || 'balanced'} → ${summary.topRecoveryTrustDriverTransitionBalanceBand || 'balanced'}${summary.topRecoveryTrustDriverTransitionBalanceReversalAdjustment ? ` (${summary.topRecoveryTrustDriverTransitionBalanceReversalAdjustment > 0 ? '+' : ''}${summary.topRecoveryTrustDriverTransitionBalanceReversalAdjustment})` : ''}` : ''}${summary.topRecoveryTrustDriverTransitionBalanceReversalStreak ? ` · balance whipsaw ${summary.topRecoveryTrustDriverTransitionBalanceReversalStreak}${summary.topRecoveryTrustDriverTransitionBalanceReversalStreakAdjustment ? ` (${summary.topRecoveryTrustDriverTransitionBalanceReversalStreakAdjustment})` : ''}` : ''}${summary.topRecoveryTrustDriverTransitionBalanceStabilityStreak ? ` · balance stable ${summary.topRecoveryTrustDriverTransitionBalanceStabilityPolarity || 'neutral'} ${summary.topRecoveryTrustDriverTransitionBalanceStabilityStreak}${summary.topRecoveryTrustDriverTransitionBalanceStabilityAdjustment ? ` (${summary.topRecoveryTrustDriverTransitionBalanceStabilityAdjustment > 0 ? '+' : ''}${summary.topRecoveryTrustDriverTransitionBalanceStabilityAdjustment})` : ''}` : ''}${summary.topRecoveryTrustDriverTransitionBalanceEntrenchmentBand && summary.topRecoveryTrustDriverTransitionBalanceEntrenchmentBand !== 'none' ? ` · entrenchment ${summary.topRecoveryTrustDriverTransitionBalanceEntrenchmentBand}${summary.topRecoveryTrustDriverTransitionBalanceEntrenchmentAdjustment ? ` (${summary.topRecoveryTrustDriverTransitionBalanceEntrenchmentAdjustment > 0 ? '+' : ''}${summary.topRecoveryTrustDriverTransitionBalanceEntrenchmentAdjustment})` : ''}` : ''}${summary.topRecoveryTrustDriverTransitionBalanceEscapedEntrenchment ? ` · entrenchment escape ${summary.topRecoveryTrustDriverTransitionBalanceEntrenchmentEscapeDirection}${summary.topRecoveryTrustDriverTransitionBalanceEntrenchmentEscapeAdjustment ? ` (${summary.topRecoveryTrustDriverTransitionBalanceEntrenchmentEscapeAdjustment > 0 ? '+' : ''}${summary.topRecoveryTrustDriverTransitionBalanceEntrenchmentEscapeAdjustment})` : ''}` : ''}${summary.topRecoveryTrustDriverTransitionBalanceEscapedEntrenchmentDurably ? ` · escape durable ${summary.topRecoveryTrustDriverTransitionBalanceEscapeDurabilityDirection} ${summary.topRecoveryTrustDriverTransitionBalanceEscapeDurabilityStreak}${summary.topRecoveryTrustDriverTransitionBalanceEscapeDurabilityAdjustment ? ` (${summary.topRecoveryTrustDriverTransitionBalanceEscapeDurabilityAdjustment > 0 ? '+' : ''}${summary.topRecoveryTrustDriverTransitionBalanceEscapeDurabilityAdjustment})` : ''}` : ''}${summary.topRecoveryTrustDriverTransitionBalanceRecapturedEntrenchment ? ` · recaptured ${summary.topRecoveryTrustDriverTransitionBalanceRecaptureDirection}${summary.topRecoveryTrustDriverTransitionBalanceRecaptureAdjustment ? ` (${summary.topRecoveryTrustDriverTransitionBalanceRecaptureAdjustment > 0 ? '+' : ''}${summary.topRecoveryTrustDriverTransitionBalanceRecaptureAdjustment})` : ''}` : ''}${summary.topRecoveryTrustDriverTransitionBalanceRecaptureStreak ? ` · recapture streak ${summary.topRecoveryTrustDriverTransitionBalanceRecaptureStreak}${summary.topRecoveryTrustDriverTransitionBalanceRecaptureStreakAdjustment ? ` (${summary.topRecoveryTrustDriverTransitionBalanceRecaptureStreakAdjustment > 0 ? '+' : ''}${summary.topRecoveryTrustDriverTransitionBalanceRecaptureStreakAdjustment})` : ''}` : ''}${summary.topRecoveryTrustDriverTransitionBalanceStructuralState && summary.topRecoveryTrustDriverTransitionBalanceStructuralState !== 'neutral' ? ` · structural state ${summary.topRecoveryTrustDriverTransitionBalanceStructuralState}${summary.topRecoveryTrustDriverTransitionBalanceStructuralAdjustment ? ` (${summary.topRecoveryTrustDriverTransitionBalanceStructuralAdjustment > 0 ? '+' : ''}${summary.topRecoveryTrustDriverTransitionBalanceStructuralAdjustment})` : ''}` : ''}</div>`
    : 'No recommendation priority data yet.';
}

function renderBaselineRecommendationOutcomes(summary = {}) {
  if (!baselineRecommendationOutcomes) return;
  const items = summary.items || [];
  if (baselineRecommendationOutcomes) baselineRecommendationOutcomes.innerHTML = `
    <div><span style="color:var(--text); font-weight:600;">${summary.totalPositive || 0}</span> positive · ${summary.totalNeutral || 0} neutral · ${summary.totalNegative || 0} negative</div>
    ${items.map((item) => `
      <div style="margin-top:10px; padding-top:10px; border-top:1px solid var(--line);">
        <div><span style="color:var(--text); font-weight:600;">${item.action}</span> · score ${item.score || 0}</div>
        <div class="task-focus-meta" style="margin-top:6px; text-transform:none; letter-spacing:normal;">+${item.positiveCount || 0} / =${item.neutralCount || 0} / -${item.negativeCount || 0}</div>
        <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">
          <button class="tag-chip" data-recommendation-outcome-action="${item.action}" data-recommendation-outcome="positive">positive</button>
          <button class="tag-chip" data-recommendation-outcome-action="${item.action}" data-recommendation-outcome="neutral">neutral</button>
          <button class="tag-chip" data-recommendation-outcome-action="${item.action}" data-recommendation-outcome="negative">negative</button>
        </div>
      </div>
    `).join('') || 'No recommendation outcomes yet.'}
  `;
}

function renderBaselineRecommendationSuppressed(items = []) {
  if (!baselineRecommendationSuppressed) return;
  if (baselineRecommendationSuppressed) baselineRecommendationSuppressed.innerHTML = items.map((item) => `
    <div style="margin-top:8px;"><span style="color:var(--text); font-weight:600;">${item.action}</span> · ${item.promotion} · outcome ${item.outcomeScore || 0} · negatives ${item.negativeCount || 0}</div>
  `).join('') || 'No suppressed recommendations right now.';
}

function renderBaselineRecommendationRevived(items = []) {
  if (!baselineRecommendationRevived) return;
  if (baselineRecommendationRevived) baselineRecommendationRevived.innerHTML = items.map((item) => `
    <div style="margin-top:8px;"><span style="color:var(--text); font-weight:600;">${item.action}</span> · revived · outcome ${item.outcomeScore || 0}${item.playbookConfidence && item.playbookConfidence !== 'none' ? ` · playbook ${item.playbookConfidence}` : ''}${item.revivalStatus ? ` · ${item.revivalStatus}${item.revivalBoost ? `${item.revivalBoost > 0 ? '+' : ''}${item.revivalBoost}` : ''}` : ''}</div>
  `).join('') || 'No revived recommendations right now.';
}

function renderBaselineRecommendationRevivalAnalytics(summary = {}) {
  if (!baselineRecommendationRevivalAnalytics) return;
  const items = summary.items || [];
  if (baselineRecommendationRevivalAnalytics) baselineRecommendationRevivalAnalytics.innerHTML = `
    <div><span style="color:var(--text); font-weight:600;">${summary.activeCount || 0}</span> active · ${summary.stickingCount || 0} sticking · ${summary.failedCount || 0} failed</div>
    ${items.map((item) => `<div style="margin-top:8px;"><span style="color:var(--text); font-weight:600;">${item.action}</span> · ${item.status || 'unknown'}</div>`).join('') || '<div style="margin-top:8px;">No revival history yet.</div>'}
  `;
}

function renderBaselineRecommendationChurn(summary = {}) {
  if (!baselineRecommendationChurn) return;
  const items = summary.items || [];
  if (baselineRecommendationChurn) baselineRecommendationChurn.innerHTML = `
    <div><span style="color:var(--text); font-weight:600;">${summary.highChurnCount || 0}</span> high-churn · ${summary.totalTracked || 0} tracked</div>
    ${items.map((item) => `<div style="margin-top:8px;"><span style="color:var(--text); font-weight:600;">${item.action}</span> · ${item.changeCount || 0} changes · ${item.previousState || 'start'} → ${item.currentState || 'unknown'}</div>`).join('') || '<div style="margin-top:8px;">No recommendation churn yet.</div>'}
  `;
}

function renderBaselineRecommendationStable(items = []) {
  if (!baselineRecommendationStable) return;
  if (baselineRecommendationStable) baselineRecommendationStable.innerHTML = items.map((item) => `
    <div style="margin-top:8px;"><span style="color:var(--text); font-weight:600;">${item.action}</span> · ${item.stabilityState || 'stable'} +${item.stableBoost || 0} · ${item.stabilityAgeHours || 0}h steady</div>
  `).join('') || 'No stable recommendations right now.';
}

function renderBaselineRecommendationConfidence(items = []) {
  if (!baselineRecommendationConfidence) return;
  if (baselineRecommendationConfidence) baselineRecommendationConfidence.innerHTML = items.map((item) => `
    <div style="margin-top:8px;"><span style="color:var(--text); font-weight:600;">${item.action}</span> · ${item.confidenceBand || 'low'} confidence${item.baseConfidenceBand && item.baseConfidenceBand !== item.confidenceBand ? ` (from ${item.baseConfidenceBand})` : ''} · ${item.confidenceTrend || 'steady'}${item.confidenceDelta ? ` (${item.confidenceDelta > 0 ? '+' : ''}${item.confidenceDelta})` : ''} · score ${item.priorityScore || 0}<div class="task-focus-meta" style="margin-top:4px; text-transform:none; letter-spacing:normal;">${item.confidenceReason || 'No confidence explanation yet.'}</div></div>
  `).join('') || 'No recommendation confidence data yet.';
}

function renderBaselineRecommendationConfidenceTrend(summary = {}) {
  if (!baselineRecommendationConfidenceTrend) return;
  const items = summary.items || [];
  if (baselineRecommendationConfidenceTrend) baselineRecommendationConfidenceTrend.innerHTML = `
    <div><span style="color:var(--text); font-weight:600;">${summary.risingCount || 0}</span> rising · ${summary.fallingCount || 0} falling · ${summary.steadyCount || 0} steady</div>
    ${items.map((item) => `<div style="margin-top:8px;"><span style="color:var(--text); font-weight:600;">${item.action}</span> · ${item.trend || 'steady'} · ${item.previousBand || 'new'} → ${item.currentBand || 'low'} · Δ ${item.delta || 0}</div>`).join('') || '<div style="margin-top:8px;">No confidence trend data yet.</div>'}
  `;
}

function renderBaselineRecommendationConfidenceVolatility(summary = {}) {
  if (!baselineRecommendationConfidenceVolatility) return;
  const items = summary.items || [];
  if (baselineRecommendationConfidenceVolatility) baselineRecommendationConfidenceVolatility.innerHTML = `
    <div><span style="color:var(--text); font-weight:600;">${summary.highVolatilityCount || 0}</span> high · ${summary.mediumVolatilityCount || 0} medium · ${summary.lowVolatilityCount || 0} low</div>
    ${items.map((item) => `<div style="margin-top:8px;"><span style="color:var(--text); font-weight:600;">${item.action}</span> · ${item.volatilityState || 'low'} volatility · shifts ${item.trendShiftCount || 0}</div>`).join('') || '<div style="margin-top:8px;">No confidence volatility data yet.</div>'}
  `;
}

function renderBaselineRecommendationConfidenceResilience(items = []) {
  if (!baselineRecommendationConfidenceResilience) return;
  if (baselineRecommendationConfidenceResilience) baselineRecommendationConfidenceResilience.innerHTML = items.map((item) => `
    <div style="margin-top:8px;"><span style="color:var(--text); font-weight:600;">${item.action}</span> · ${item.resilienceBand || 'fragile'} resilience · score ${item.resilienceScore || 0}</div>
  `).join('') || 'No confidence resilience data yet.';
}

function renderBaselineRecommendationConfidenceAdjustments(summary = {}) {
  if (!baselineRecommendationConfidenceAdjustments) return;
  const items = summary.items || [];
  if (baselineRecommendationConfidenceAdjustments) baselineRecommendationConfidenceAdjustments.innerHTML = `
    <div><span style="color:var(--text); font-weight:600;">${summary.upgradedCount || 0}</span> upgraded · ${summary.downgradedCount || 0} downgraded · ${summary.adjustedCount || 0} adjusted · ${summary.convergedCount || 0} converged · ${summary.justConvergedCount || 0} just converged · ${summary.dependentCount || 0} dependent · ${summary.justBecameDependentCount || 0} just dependent · ${summary.recoveredCount || 0} recovered · ${summary.justRecoveredCount || 0} just recovered · ${summary.durableRecoveredCount || 0} durable · ${summary.justDurableRecoveredCount || 0} just durable · ${summary.relapsedCount || 0} relapsed · ${summary.justRelapsedCount || 0} just relapsed · ${summary.resilientRecoveryCount || 0} resilient · ${summary.fragileRecoveryCount || 0} fragile · ${summary.matureRecoveryCount || 0} mature · ${summary.developingRecoveryCount || 0} developing · ${summary.risingRecoveryCount || 0} rising · ${summary.fallingRecoveryCount || 0} falling · ${summary.recoveryMaturityReversalCount || 0} reversed · ${summary.justReversedRecoveryCount || 0} just reversed · ${summary.reversalStreakRecoveryCount || 0} whipsawing · ${summary.stableRecoveryCount || 0} stable · ${summary.highBreakdownRiskCount || 0} high risk · ${summary.watchBreakdownRiskCount || 0} watch · ${summary.strongRecoveryHealthCount || 0} strong · ${summary.stableRecoveryHealthCount || 0} healthy · ${summary.fragileRecoveryHealthCount || 0} fragile health · ${summary.improvingRecoveryHealthCount || 0} improving · ${summary.decayingRecoveryHealthCount || 0} decaying · ${summary.reversedRecoveryHealthCount || 0} health reversed · ${summary.justReversedRecoveryHealthCount || 0} health just reversed · ${summary.reversalStreakRecoveryHealthCount || 0} health whipsawing · ${summary.positiveRecoveryTrustNetCount || 0} net positive · ${summary.negativeRecoveryTrustNetCount || 0} net negative · ${summary.healthDrivenRecoveryCount || 0} health-led · ${summary.maturityDrivenRecoveryCount || 0} maturity-led · ${summary.riskDrivenRecoveryCount || 0} risk-led · ${summary.driverShiftRecoveryCount || 0} shifted · ${summary.justShiftedRecoveryCount || 0} just shifted · ${summary.driverShiftStreakRecoveryCount || 0} driver churn · ${summary.positiveDriverTransitionCount || 0} positive transitions · ${summary.negativeDriverTransitionCount || 0} negative transitions · ${summary.deterioratingDriverTransitionCount || 0} deteriorating · ${summary.negativeDriverTransitionStreakCount || 0} deterioration streaks · ${summary.positiveDriverTransitionStreakCount || 0} recovery streaks · ${summary.positiveDriverTransitionBalanceCount || 0} recovery-led balance · ${summary.negativeDriverTransitionBalanceCount || 0} deterioration-led balance · ${summary.balancedDriverTransitionBalanceCount || 0} balanced · ${summary.reversedDriverTransitionBalanceCount || 0} reversed · ${summary.positiveReversedDriverTransitionBalanceCount || 0} positive reversals · ${summary.negativeReversedDriverTransitionBalanceCount || 0} negative reversals · ${summary.reversalStreakDriverTransitionBalanceCount || 0} balance whipsaws · ${summary.stableDriverTransitionBalanceCount || 0} balance stable · ${summary.stableRecoveryLedDriverTransitionBalanceCount || 0} stable recovery-led · ${summary.stableDeteriorationLedDriverTransitionBalanceCount || 0} stable deterioration-led · ${summary.entrenchedDriverTransitionBalanceCount || 0} entrenched · ${summary.recoveryEntrenchedDriverTransitionBalanceCount || 0} recovery entrenched · ${summary.deteriorationEntrenchedDriverTransitionBalanceCount || 0} deterioration entrenched · ${summary.justEntrenchedDriverTransitionBalanceCount || 0} just entrenched · ${summary.escapedEntrenchedDriverTransitionBalanceCount || 0} escaped entrenchment · ${summary.positiveEscapedEntrenchedDriverTransitionBalanceCount || 0} positive escapes · ${summary.negativeEscapedEntrenchedDriverTransitionBalanceCount || 0} negative escapes · ${summary.durableEscapedEntrenchedDriverTransitionBalanceCount || 0} durable escapes · ${summary.durablePositiveEscapedEntrenchedDriverTransitionBalanceCount || 0} durable positive escapes · ${summary.durableNegativeEscapedEntrenchedDriverTransitionBalanceCount || 0} durable negative escapes · ${summary.recapturedEntrenchedDriverTransitionBalanceCount || 0} recaptured · ${summary.positiveRecapturedEntrenchedDriverTransitionBalanceCount || 0} positive recaptures · ${summary.negativeRecapturedEntrenchedDriverTransitionBalanceCount || 0} negative recaptures · ${summary.recaptureStreakDriverTransitionBalanceCount || 0} recapture whipsaws · ${summary.terminalStructuralStateCount || 0} terminal · ${summary.compromisedStructuralStateCount || 0} compromised · ${summary.weakeningStructuralStateCount || 0} weakening · ${summary.contestedStructuralStateCount || 0} contested · ${summary.soundStructuralStateCount || 0} sound · ${summary.fortifiedStructuralStateCount || 0} fortified</div>
    ${items.map((item) => `<div style="margin-top:8px;"><span style="color:var(--text); font-weight:600;">${item.action}</span> · ${item.adjustmentDirection || 'none'} · ${item.adjustmentCount || 0} adjustments · up ${item.upgradedCount || 0} / down ${item.downgradedCount || 0}${item.convergenceStreak ? ` · convergence ${item.convergenceStreak}` : ''}${item.justConverged ? ' · just converged' : ''}${item.dependencyStreak ? ` · dependent ${item.dependencyStreak}` : ''}${item.justBecameDependent ? ' · just dependent' : ''}${item.dependencyRecoveryStreak ? ` · recovery ${item.dependencyRecoveryStreak}` : ''}${item.justRecoveredFromDependency ? ' · just recovered' : ''}${item.dependencyRecoveryDurability && item.dependencyRecoveryDurability !== 'fragile' ? ` · recovery ${item.dependencyRecoveryDurability}` : ''}${item.justBecameDurableRecovery ? ' · just durable' : ''}${item.justRelapsedFromDurableRecovery ? ' · just relapsed' : ''}${item.relapseResilienceBand && item.relapseResilienceBand !== 'neutral' ? ` · relapse ${item.relapseResilienceBand} ${item.relapseResilienceScore}` : ''}${item.recoveryMaturityBand && item.recoveryMaturityBand !== 'early' ? ` · recovery ${item.recoveryMaturityBand} ${item.recoveryMaturityScore}` : ''}${item.recoveryMaturityDrift && item.recoveryMaturityDrift !== 'steady' ? ` · maturity ${item.recoveryMaturityDrift} ${item.recoveryMaturityDelta > 0 ? '+' : ''}${item.recoveryMaturityDelta}` : ''}${item.recoveryMaturityJustReversed ? ` · just reversed ${item.recoveryMaturityDrift}` : ''}${item.recoveryMaturityReversalStreak ? ` · whipsaw ${item.recoveryMaturityReversalStreak}` : ''}${item.recoveryMaturityStabilityStreak ? ` · stable ${item.recoveryMaturityStabilityStreak}` : ''}${item.recoveryMaturityBreakdownRiskBand && item.recoveryMaturityBreakdownRiskBand !== 'low' ? ` · risk ${item.recoveryMaturityBreakdownRiskBand} ${item.recoveryMaturityBreakdownRiskScore}` : ''}${item.recoveryTrustHealthBand ? ` · health ${item.recoveryTrustHealthBand} ${item.recoveryTrustHealthScore}` : ''}${item.recoveryTrustHealthTrend && item.recoveryTrustHealthTrend !== 'steady' ? ` · health ${item.recoveryTrustHealthTrend} ${item.recoveryTrustHealthDelta > 0 ? '+' : ''}${item.recoveryTrustHealthDelta}` : ''}${item.recoveryTrustHealthJustReversed ? ` · health just reversed ${item.recoveryTrustHealthTrend}` : ''}${item.recoveryTrustHealthReversalStreak ? ` · health whipsaw ${item.recoveryTrustHealthReversalStreak}` : ''}${item.recoveryTrustAdjustmentSummary ? ` · stack ${item.recoveryTrustAdjustmentSummary}${item.recoveryTrustNetAdjustment ? ` · net ${item.recoveryTrustNetAdjustment > 0 ? '+' : ''}${item.recoveryTrustNetAdjustment}` : ''}${item.recoveryTrustTopDriver ? ` · driver ${item.recoveryTrustTopDriver}${item.recoveryTrustTopDriverAdjustment ? ` (${item.recoveryTrustTopDriverAdjustment > 0 ? '+' : ''}${item.recoveryTrustTopDriverAdjustment})` : ''}` : ''}` : ''}${item.recoveryTrustDriverJustShifted ? ` · shifted ${item.previousRecoveryTrustTopDriver || 'none'} → ${item.recoveryTrustTopDriver || 'none'}${item.recoveryTrustDriverTransitionSeverityBand && item.recoveryTrustDriverTransitionSeverityBand !== 'neutral' ? ` · ${item.recoveryTrustDriverTransitionSeverityBand} ${item.recoveryTrustDriverTransitionSeverityScore > 0 ? '+' : ''}${item.recoveryTrustDriverTransitionSeverityScore}` : ''}` : ''}${item.recoveryTrustDriverShiftStreak ? ` · driver churn ${item.recoveryTrustDriverShiftStreak}` : ''}${item.recoveryTrustDriverNegativeTransitionStreak ? ` · deterioration streak ${item.recoveryTrustDriverNegativeTransitionStreak}` : ''}${item.recoveryTrustDriverPositiveTransitionStreak ? ` · recovery streak ${item.recoveryTrustDriverPositiveTransitionStreak}` : ''}${item.recoveryTrustDriverTransitionBalanceScore ? ` · balance ${item.recoveryTrustDriverTransitionBalanceBand || 'balanced'} ${item.recoveryTrustDriverTransitionBalanceScore > 0 ? '+' : ''}${item.recoveryTrustDriverTransitionBalanceScore}` : ''}${item.recoveryTrustDriverTransitionBalanceJustReversed ? ` · reversed ${item.previousRecoveryTrustDriverTransitionBalanceBand || 'balanced'} → ${item.recoveryTrustDriverTransitionBalanceBand || 'balanced'}` : ''}${item.recoveryTrustDriverTransitionBalanceReversalStreak ? ` · whipsaw ${item.recoveryTrustDriverTransitionBalanceReversalStreak}` : ''}${item.recoveryTrustDriverTransitionBalanceStabilityStreak ? ` · stable ${item.recoveryTrustDriverTransitionBalanceStabilityPolarity || 'neutral'} ${item.recoveryTrustDriverTransitionBalanceStabilityStreak}` : ''}${item.recoveryTrustDriverTransitionBalanceEntrenchmentBand && item.recoveryTrustDriverTransitionBalanceEntrenchmentBand !== 'none' ? ` · entrenched ${item.recoveryTrustDriverTransitionBalanceEntrenchmentBand}` : ''}${item.recoveryTrustDriverTransitionBalanceEscapedEntrenchment ? ` · escape ${item.recoveryTrustDriverTransitionBalanceEntrenchmentEscapeDirection}` : ''}${item.recoveryTrustDriverTransitionBalanceEscapedEntrenchmentDurably ? ` · durable escape ${item.recoveryTrustDriverTransitionBalanceEscapeDurabilityDirection} ${item.recoveryTrustDriverTransitionBalanceEscapeDurabilityStreak}` : ''}${item.recoveryTrustDriverTransitionBalanceRecapturedEntrenchment ? ` · recaptured ${item.recoveryTrustDriverTransitionBalanceRecaptureDirection}` : ''}${item.recoveryTrustDriverTransitionBalanceRecaptureStreak ? ` · recapture streak ${item.recoveryTrustDriverTransitionBalanceRecaptureStreak}` : ''}${item.recoveryTrustDriverTransitionBalanceStructuralState && item.recoveryTrustDriverTransitionBalanceStructuralState !== 'neutral' ? ` · structural state ${item.recoveryTrustDriverTransitionBalanceStructuralState}` : ''}</div>`).join('') || '<div style="margin-top:8px;">No confidence adjustments yet.</div>'}
  `;
}

function renderBaselineRecommendationTrustMomentum(summary = {}) {
  if (!baselineRecommendationTrustMomentum) return;
  const items = summary.items || [];
  if (baselineRecommendationTrustMomentum) baselineRecommendationTrustMomentum.innerHTML = `
    <div><span style="color:var(--text); font-weight:600;">${summary.positiveCount || 0}</span> positive · ${summary.negativeCount || 0} negative · ${summary.neutralCount || 0} neutral · ${summary.justReversedCount || 0} just reversed · ${summary.streakingCount || 0} streaking · ${summary.stableCount || 0} stable</div>
    ${items.map((item) => `<div style="margin-top:8px;"><span style="color:var(--text); font-weight:600;">${item.action}</span> · ${item.trustMomentumBand || 'neutral'} · score ${item.trustMomentumScore || 0}${item.trustMomentumJustReversed ? ' · just reversed' : ''}${item.trustMomentumReversalCount ? ` · reversals ${item.trustMomentumReversalCount}` : ''}${item.trustMomentumReversalStreak ? ` · streak ${item.trustMomentumReversalStreak}` : ''}${item.trustMomentumStabilityStreak ? ` · stable ${item.trustMomentumStabilityStreak}` : ''}</div>`).join('') || '<div style="margin-top:8px;">No trust momentum data yet.</div>'}
  `;
}

function renderBaselineRecommendationPlaybook(summary = {}) {
  if (!baselineRecommendationPlaybook) return;
  const items = summary.items || [];
  if (baselineRecommendationPlaybook) baselineRecommendationPlaybook.innerHTML = `
    ${summary.topAction ? `<div><span style="color:var(--text); font-weight:600;">${summary.topAction}</span> · ${summary.topConfidence || 'emerging'} · score ${summary.topScore || 0}</div>` : '<div>No learned playbook entries yet.</div>'}
    ${items.map((item) => `<div style="margin-top:8px;"><span style="color:var(--text); font-weight:600;">${item.action}</span> · ${item.confidence} · playbook ${item.playbookScore || 0}${item.freshness ? ` · ${item.freshness}` : ''}</div>`).join('')}
  `;
}

async function trackBaselineRecommendationImpressions(items = []) {
  const actions = [...new Set((items || []).map((item) => item.action).filter(Boolean))];
  if (!actions.length) return;
  try {
    await fetchJson('api/baseline-recommendation-impression.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actions })
    });
  } catch {}
}

function renderBaselineMaintenanceAnalytics(summary = {}) {
  if (!baselineMaintenanceAnalytics) return;
  const items = summary.items || [];
  if (baselineMaintenanceAnalytics) baselineMaintenanceAnalytics.innerHTML = `
    <div><span style="color:var(--text); font-weight:600;">${summary.totalRuns || 0}</span> maintenance runs tracked</div>
    ${items.map((item) => `<div style="margin-top:8px;"><span style="color:var(--text); font-weight:600;">${item.action}</span> · ${item.count || 0} runs</div>`).join('') || '<div style="margin-top:8px;">No maintenance runs yet.</div>'}
  `;
}

function renderBaselineMaintenanceEffectiveness(summary = {}) {
  if (!baselineMaintenanceEffectiveness) return;
  const items = summary.items || [];
  if (baselineMaintenanceEffectiveness) baselineMaintenanceEffectiveness.innerHTML = `
    <div><span style="color:var(--text); font-weight:600;">${summary.totalRemoved || 0}</span> entries removed across <span style="color:var(--text); font-weight:600;">${summary.totalRuns || 0}</span> runs</div>
    <div style="margin-top:8px;">Effective ${summary.effectiveCount || 0} · Mixed ${summary.mixedCount || 0} · Weak ${summary.weakCount || 0}</div>
    ${items.map((item) => `<div style="margin-top:8px;"><span style="color:var(--text); font-weight:600;">${item.action}</span> · ${item.effectiveness} · avg removed ${item.avgRemoved || 0}</div>`).join('') || '<div style="margin-top:8px;">No maintenance effectiveness data yet.</div>'}
  `;
}

async function updateBaselineHistory(stats, baselineLabel = 'prior equivalent window') {
  if (!stats || !currentTimelineFilter) {
    renderBaselineHistory();
    return;
  }
  if (currentBaselineMode === 'saved' && !currentBaselineViewId) {
    renderBaselineHistory();
    return;
  }

  const signature = [
    currentTimelineFilter,
    currentTimelineWindowMinutes,
    currentSeverityFilter || '',
    currentSourceFilter || '',
    currentRecoveredFilter ? '1' : '0',
    currentFeedView || 'active',
    currentBaselineMode || 'previous',
    currentBaselineViewId || '',
    stats.score,
    stats.label
  ].join('|');

  const history = readBaselineHistory();
  if (history[0]?.signature === signature) {
    renderBaselineHistory(history);
    return;
  }

  const entry = {
    signature,
    label: stats.label,
    score: stats.score,
    baselineLabel,
    anchorTime: currentTimelineFilter,
    windowMinutes: currentTimelineWindowMinutes,
    severityFilter: currentSeverityFilter,
    sourceFilter: currentSourceFilter,
    recoveredFilter: currentRecoveredFilter,
    feedView: currentFeedView,
    baselineMode: currentBaselineMode,
    baselineViewId: currentBaselineViewId,
    recordedAt: new Date().toISOString()
  };

  const next = [entry, ...history].slice(0, 12);

  writeBaselineHistory(next);
  renderBaselineHistory(next);

  const serverItems = await persistBaselineHistoryServer(entry);
  if (Array.isArray(serverItems)) {
    writeBaselineHistory(serverItems);
    renderBaselineHistory(serverItems);
  }
}

function renderTimelineViews(items = []) {
  currentTimelineViews = items;
  if (!timelineViewsList) return;

  if (timelineViewsList) timelineViewsList.innerHTML = items.map((view) => {
    const isActive = String(view.anchorTime || '') === String(currentTimelineFilter || '')
      && Number(view.windowMinutes || 60) === Number(currentTimelineWindowMinutes)
      && String(view.feedView || 'active') === String(currentFeedView || 'active')
      && String(view.severityFilter || '') === String(currentSeverityFilter || '');

    return `
      <div class="filter-row" style="justify-content:space-between; align-items:flex-start; gap:8px; margin-bottom:8px;">
        <button class="tag-chip ${isActive ? 'active' : ''}" data-timeline-view-id="${view.id}" style="text-align:left; flex:1;">
          ${formatTimelineViewName(view)}
          <div class="task-focus-meta" style="margin-top:6px; text-transform:none; letter-spacing:normal;">${formatWindowLabel(view.windowMinutes || 60)} · ${(view.feedView || 'active')} feed${view.severityFilter ? ` · ${view.severityFilter}` : ''}</div>
        </button>
        <button class="ghost-btn" data-delete-timeline-view-id="${view.id}">Delete</button>
      </div>
    `;
  }).join('') || '<div class="task-focus-meta">No saved temporal views yet.</div>';
}

function renderFeedWindowSummary(items = []) {
  if (!feedWindowSummary) return;
  if (items.length === 0) {
    if (feedWindowSummary) feedWindowSummary.innerHTML = currentTimelineFilter
      ? `No signals in the current ${formatWindowLabel(currentTimelineWindowMinutes)}.`
      : 'No signals in the current view.';
    return;
  }

  const sourceCounts = items.reduce((acc, item) => {
    acc[item.source] = (acc[item.source] || 0) + 1;
    return acc;
  }, {});
  const severityCounts = items.reduce((acc, item) => {
    acc[item.severity] = (acc[item.severity] || 0) + 1;
    return acc;
  }, { high: 0, medium: 0, low: 0 });
  const sorted = [...items].sort((a, b) => strcmpSafe(a.timestamp, b.timestamp));
  const earliest = sorted[0];
  const latest = sorted[sorted.length - 1];
  const topSources = Object.entries(sourceCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([source, count]) => `${source} (${count})`)
    .join(' · ');
  const scopePrefix = currentTimelineFilter ? `${formatWindowLabel(currentTimelineWindowMinutes)} · ` : '';

  if (feedWindowSummary) feedWindowSummary.innerHTML = `
    <div><span style="color:var(--text); font-weight:600;">${items.length}</span> visible signals · ${severityCounts.high || 0} high · ${severityCounts.medium || 0} medium · ${severityCounts.low || 0} low</div>
    <div style="margin-top:8px;">${scopePrefix}Window: ${formatClock(earliest.timestamp)} to ${formatClock(latest.timestamp)} · Top sources: ${topSources || 'n/a'}</div>
  `;
}

function renderTimelineComparison(currentItems = [], previousItems = [], baselineLabel = 'prior equivalent window') {
  if (!timelineComparisonSummary) return;

  if (!currentTimelineFilter) {
    if (timelineComparisonSummary) timelineComparisonSummary.innerHTML = 'Select a timeline window to compare it against the prior equivalent window.';
    return;
  }

  if (currentBaselineMode === 'saved' && !currentBaselineViewId) {
    if (timelineComparisonSummary) timelineComparisonSummary.innerHTML = 'Choose a saved temporal view to use as the comparison baseline.';
    return;
  }

  const currentCount = currentItems.length;
  const previousCount = previousItems.length;
  const delta = currentCount - previousCount;
  const deltaLabel = delta > 0 ? `+${delta}` : `${delta}`;
  const direction = delta > 0 ? 'hotter' : delta < 0 ? 'cooler' : 'steady';

  const summarizeSources = (items) => Object.entries(items.reduce((acc, item) => {
    acc[item.source] = (acc[item.source] || 0) + 1;
    return acc;
  }, {})).sort((a, b) => b[1] - a[1])[0] || null;

  const currentTopSource = summarizeSources(currentItems);
  const previousTopSource = summarizeSources(previousItems);
  const currentHigh = currentItems.filter((item) => item.severity === 'high').length;
  const previousHigh = previousItems.filter((item) => item.severity === 'high').length;
  const sourceDeltaMap = new Map();

  currentItems.forEach((item) => {
    sourceDeltaMap.set(item.source, (sourceDeltaMap.get(item.source) || 0) + 1);
  });
  previousItems.forEach((item) => {
    sourceDeltaMap.set(item.source, (sourceDeltaMap.get(item.source) || 0) - 1);
  });

  const sourceDeltaHtml = Array.from(sourceDeltaMap.entries())
    .filter(([, value]) => value !== 0)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]) || a[0].localeCompare(b[0]))
    .slice(0, 4)
    .map(([source, value]) => `<button class="tag-chip" data-compare-source="${source}">${source} ${value > 0 ? '+' : ''}${value}</button>`)
    .join('');

  if (timelineComparisonSummary) timelineComparisonSummary.innerHTML = `
    <div><span style="color:var(--text); font-weight:600;">${currentCount}</span> current vs <span style="color:var(--text); font-weight:600;">${previousCount}</span> previous · delta <span style="color:var(--text); font-weight:600;">${deltaLabel}</span></div>
    <div style="margin-top:8px;">Baseline: <span style="color:var(--text); font-weight:600;">${baselineLabel}</span></div>
    <div style="margin-top:8px;">Window looks <span style="color:var(--text); font-weight:600;">${direction}</span> than the selected baseline slice.</div>
    <div style="margin-top:8px;">High severity: ${currentHigh} now vs ${previousHigh} prior</div>
    <div style="margin-top:8px;">Top source now: ${currentTopSource ? `${currentTopSource[0]} (${currentTopSource[1]})` : 'n/a'} · prior: ${previousTopSource ? `${previousTopSource[0]} (${previousTopSource[1]})` : 'n/a'}</div>
    <div class="filter-row" style="flex-wrap:wrap; margin-top:10px;">${sourceDeltaHtml || '<span class="task-focus-meta">No source deltas in this comparison.</span>'}</div>
  `;
}

function renderBaselineShift(currentItems = [], previousItems = [], baselineLabel = 'prior equivalent window') {
  if (!baselineShiftSummary) return;

  if (!currentTimelineFilter) {
    if (baselineShiftSummary) baselineShiftSummary.innerHTML = 'Baseline scoring will appear once a timeline window is selected.';
    return null;
  }

  if (currentBaselineMode === 'saved' && !currentBaselineViewId) {
    if (baselineShiftSummary) baselineShiftSummary.innerHTML = 'Select a saved temporal view to score the current window against it.';
    return null;
  }

  const stats = computeBaselineShiftStats(currentItems, previousItems);
  const { delta, highDelta, score, label } = stats;

  if (baselineShiftSummary) baselineShiftSummary.innerHTML = `
    <div><span style="color:var(--text); font-weight:600;">${label}</span> baseline shift</div>
    <div style="margin-top:8px;">Against: ${baselineLabel}</div>
    <div style="margin-top:8px;">Score: <span style="color:var(--text); font-weight:600;">${score > 0 ? '+' : ''}${score}</span> from signal volume and high-severity movement.</div>
    <div style="margin-top:8px;">Signal delta: ${delta > 0 ? '+' : ''}${delta} · High-severity delta: ${highDelta > 0 ? '+' : ''}${highDelta}</div>
  `;

  return stats;
}

function renderTimelineFocus(items = []) {
  if (!timelineFocusStatus || !timelineFocusSummary) return;

  if (!items.length) {
    if (timelineFocusStatus) timelineFocusStatus.textContent = currentTimelineFilter ? 'Empty time scope' : 'Full feed window';
    if (timelineFocusSummary) timelineFocusSummary.innerHTML = currentTimelineFilter
      ? `No signals fall inside the selected ${formatWindowLabel(currentTimelineWindowMinutes)}.`
      : 'Click a live marker to isolate a temporal investigation window.';
    if (clearTimelineFilterButton) clearTimelineFilterButton.classList.toggle('active', Boolean(currentTimelineFilter));
    syncTimelineWindowButtons();
    return;
  }

  const sourceCounts = items.reduce((acc, item) => {
    acc[item.source] = (acc[item.source] || 0) + 1;
    return acc;
  }, {});
  const taskCounts = items.reduce((acc, item) => {
    if (item.taskTag) acc[item.taskTag] = (acc[item.taskTag] || 0) + 1;
    return acc;
  }, {});
  const severityCounts = items.reduce((acc, item) => {
    acc[item.severity] = (acc[item.severity] || 0) + 1;
    return acc;
  }, { high: 0, medium: 0, low: 0 });
  const sourceHtml = Object.entries(sourceCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([source, count]) => `<span class="tag-chip">${source} (${count})</span>`)
    .join('');
  const taskHtml = Object.entries(taskCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([taskTag, count]) => `<span class="tag-chip">${taskTag} (${count})</span>`)
    .join('');

  if (currentTimelineFilter) {
    const selectedTime = Number(currentTimelineFilter);
    const windowRadiusMs = Number(currentTimelineWindowMinutes) * 60 * 1000;
    const windowStart = new Date(selectedTime - windowRadiusMs);
    const windowEnd = new Date(selectedTime + windowRadiusMs);
    if (timelineFocusStatus) timelineFocusStatus.textContent = `${formatClock(windowStart)} to ${formatClock(windowEnd)}`;
    if (timelineFocusSummary) timelineFocusSummary.innerHTML = `
      <div><span style="color:var(--text); font-weight:600;">${items.length}</span> signals inside the active ${formatWindowLabel(currentTimelineWindowMinutes)}.</div>
      <div style="margin-top:8px;">Severity mix: ${severityCounts.high || 0} high · ${severityCounts.medium || 0} medium · ${severityCounts.low || 0} low</div>
      <div class="filter-row" style="flex-wrap:wrap; margin-top:12px;">${sourceHtml || '<span class="task-focus-meta">No source breakdown available.</span>'}</div>
      <div class="filter-row" style="flex-wrap:wrap; margin-top:10px;">${taskHtml || '<span class="task-focus-meta">No linked task tags in this slice.</span>'}</div>
    `;
  } else {
    const sorted = [...items].sort((a, b) => strcmpSafe(a.timestamp, b.timestamp));
    if (timelineFocusStatus) timelineFocusStatus.textContent = `${formatClock(sorted[0].timestamp)} to ${formatClock(sorted[sorted.length - 1].timestamp)}`;
    if (timelineFocusSummary) timelineFocusSummary.innerHTML = `
      <div><span style="color:var(--text); font-weight:600;">${items.length}</span> signals are currently visible. Click a timeline marker to pivot into a tighter time scope.</div>
      <div style="margin-top:8px;">Severity mix: ${severityCounts.high || 0} high · ${severityCounts.medium || 0} medium · ${severityCounts.low || 0} low</div>
      <div class="filter-row" style="flex-wrap:wrap; margin-top:12px;">${sourceHtml || '<span class="task-focus-meta">No source breakdown available.</span>'}</div>
    `;
  }

  if (clearTimelineFilterButton) clearTimelineFilterButton.classList.toggle('active', Boolean(currentTimelineFilter));
  syncTimelineWindowButtons();
}

function strcmpSafe(a, b) {
  return String(a || '').localeCompare(String(b || ''));
}

function renderSignalFeed(items = []) {
  if (signalFeedList) signalFeedList.innerHTML = items.map(item => {
    const archiveBadge = currentFeedView === 'archived' ? `<span class="muted" style="text-transform:uppercase; font-size:0.7rem; border:1px solid var(--border); padding:2px 6px; border-radius:4px;">${item.status}</span>` : '';
    
    let actionsHtml = '';
    if (currentFeedView === 'active') {
      actionsHtml = `
        <button class="signal-btn" data-signal-id="${item.id}" data-signal-action="acknowledge">Acknowledge</button>
        <button class="signal-btn" data-signal-id="${item.id}" data-signal-action="escalate">Escalate</button>
        <button class="signal-btn" data-signal-id="${item.id}" data-signal-action="dismiss">Dismiss</button>
      `;
    } else if (item.status === 'escalate') {
      const currentOutcome = item.escalationOutcome || '';
      actionsHtml = `
        <span class="muted" style="font-size:0.75rem; margin-right:4px;">Outcome:</span>
        <button class="signal-btn ${currentOutcome === 'positive' ? 'active' : ''}" data-signal-id="${item.id}" data-signal-score="positive">Pos</button>
        <button class="signal-btn ${currentOutcome === 'neutral' ? 'active' : ''}" data-signal-id="${item.id}" data-signal-score="neutral">Neu</button>
        <button class="signal-btn ${currentOutcome === 'negative' ? 'active' : ''}" data-signal-id="${item.id}" data-signal-score="negative">Neg</button>
        <button class="signal-btn" style="margin-left: 12px; border-color: var(--lime-dark); color: var(--lime-dark);" data-signal-id="${item.id}" data-signal-action="convert">Convert to Task</button>
      `;
    } else if (item.status === 'converted') {
      actionsHtml = `<span class="muted" style="font-size:0.75rem;">Converted to Watcher Task</span>`;
    } else {
      actionsHtml = `<button class="signal-btn" data-signal-id="${item.id}" data-signal-action="recover">Recover to Active</button>`;
    }
      
    return `
      <div class="signal-item">
        <div class="signal-meta">
          <span class="sev-${item.severity}">${item.severity}</span>
          <span class="muted">${item.source}</span>
          <span class="muted">${formatClock(item.timestamp)}</span>
          ${archiveBadge}
        </div>
        <div class="signal-title">${item.title}</div>
        <div class="signal-actions">
          ${actionsHtml}
        </div>
      </div>
    `;
  }).join('') || `<div class="task-focus-meta">No ${currentFeedView} signals right now.</div>`;
}

function renderTimeline(items = []) {
  if (items.length === 0) {
    if (timelineContainer) timelineContainer.innerHTML = '<div style="padding:18px; color:var(--muted); font-size:0.8rem; text-align:center;">No signals to plot</div>';
    return;
  }

  const times = items.map(i => new Date(i.timestamp).getTime());
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const range = maxTime - minTime || 1000;
  const activeScope = currentTimelineFilter ? Number(currentTimelineFilter) : null;
  const windowRadiusMs = Number(currentTimelineWindowMinutes) * 60 * 1000;

  const axisHtml = `
    <div style="position:absolute; left:12px; right:12px; top:50%; height:1px; background:var(--border);"></div>
    <div style="position:absolute; left:12px; bottom:8px; font-size:0.72rem; color:var(--muted);">${formatClock(minTime)}</div>
    <div style="position:absolute; right:12px; bottom:8px; font-size:0.72rem; color:var(--muted);">${formatClock(maxTime)}</div>
  `;

  let activeWindowHtml = '';
  if (activeScope !== null) {
    const scopeStart = Math.max(minTime, activeScope - windowRadiusMs);
    const scopeEnd = Math.min(maxTime, activeScope + windowRadiusMs);
    const leftPct = ((scopeStart - minTime) / range) * 98 + 1;
    const rightPct = ((scopeEnd - minTime) / range) * 98 + 1;
    const widthPct = Math.max(rightPct - leftPct, 1.5);
    activeWindowHtml = `<div title="${formatWindowLabel(currentTimelineWindowMinutes)}" style="position:absolute; left:${leftPct}%; width:${widthPct}%; top:12px; bottom:18px; background:rgba(196,214,0,0.12); border:1px solid rgba(196,214,0,0.35); border-radius:8px;"></div>`;
  }

  const plotsHtml = items.map(item => {
    const t = new Date(item.timestamp).getTime();
    const pct = ((t - minTime) / range) * 98 + 1;
    const inActiveWindow = activeScope !== null && Math.abs(activeScope - t) <= windowRadiusMs;
    const color = item.severity === 'high' ? '#ff5252' : item.severity === 'medium' ? '#fb8c00' : 'var(--lime)';
    const glow = inActiveWindow ? '0 0 0 3px rgba(196,214,0,0.16)' : 'none';
    const height = inActiveWindow ? 32 : 24;
    return `<div data-timeline-time="${t}" title="${item.title}" style="position:absolute; left:${pct}%; top:50%; transform:translate(-50%, -50%); width:10px; height:${height}px; background:${color}; border-radius:999px; cursor:pointer; box-shadow:${glow}; border:${inActiveWindow ? '1px solid var(--lime)' : 'none'};"></div>`;
  }).join('');

  if (timelineContainer) timelineContainer.innerHTML = axisHtml + activeWindowHtml + plotsHtml;
}


function startAutoRefresh() {
  if (autoRefreshTimer) clearInterval(autoRefreshTimer);
  autoRefreshTimer = setInterval(() => {
    loadIntel();
  }, 30000); // 30s refresh, not 5s
}

signalSeverityFilters?.addEventListener('click', async (event) => {
  const btn = event.target.closest('[data-severity]');
  if (!btn) return;

  const sev = btn.dataset.severity;
  currentSeverityFilter = sev === 'all' ? null : sev;
  currentTimelineFilter = null;
  syncSeverityFilterButtons();
  await loadIntel();
});

if (timelineContainer) {
  timelineContainer.addEventListener('click', async (event) => {
    const plot = event.target.closest('[data-timeline-time]');
    if (!plot) {
      if (currentTimelineFilter) {
        currentTimelineFilter = null;
  if (overviewHeadline) overviewHeadline.textContent = 'Cleared timeline filter.';
        await loadIntel();
      }
      return;
    }
    const t = plot.dataset.timelineTime;
    currentTimelineFilter = t;
    setSelected({ suggestedQuery: 'Time Scope', topic: 'Temporal Filter', thirdOrderEscalationAction: `filtering by ${formatWindowLabel(currentTimelineWindowMinutes)}` });
  if (overviewHeadline) overviewHeadline.textContent = `Live feed scoped to selected ${formatWindowLabel(currentTimelineWindowMinutes)}.`;
    await loadIntel();
  });
}

if (timelineWindowButtons) {
  timelineWindowButtons.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-window-minutes]');
    if (!button) return;

    const nextMinutes = Number(button.dataset.windowMinutes || 60);
    if (!nextMinutes || nextMinutes === currentTimelineWindowMinutes) return;

    currentTimelineWindowMinutes = nextMinutes;
    syncTimelineWindowButtons();

    if (currentTimelineFilter) {
  if (overviewHeadline) overviewHeadline.textContent = `Timeline scope updated to ${formatWindowLabel(currentTimelineWindowMinutes)}.`;
    }

    await loadIntel();
  });
}

if (clearTimelineFilterButton) {
  clearTimelineFilterButton.addEventListener('click', async () => {
    if (!currentTimelineFilter) return;
    currentTimelineFilter = null;
  if (overviewHeadline) overviewHeadline.textContent = 'Cleared timeline filter.';
    await loadIntel();
  });
}

if (signalViewFilters) {
  signalViewFilters.addEventListener('click', async (event) => {
    const btn = event.target.closest('[data-feed-view]');
    if (!btn) return;

    currentFeedView = btn.dataset.feedView;
    syncFeedViewButtons();
    await loadIntel();
  });
}

if (saveTimelineViewButton) {
  saveTimelineViewButton.addEventListener('click', async () => {
    if (!currentTimelineFilter) {
  if (overviewHeadline) overviewHeadline.textContent = 'Pick a timeline window before saving a temporal view.';
      return;
    }

    const defaultName = `${formatClock(currentTimelineFilter)} · ${formatWindowLabel(currentTimelineWindowMinutes)}`;
    const name = window.prompt('Name this temporal view', defaultName);
    if (!name) return;

    await fetchJson('api/timeline-views.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        anchorTime: currentTimelineFilter,
        windowMinutes: currentTimelineWindowMinutes,
        severityFilter: currentSeverityFilter,
        sourceFilter: currentSourceFilter,
        recoveredFilter: currentRecoveredFilter,
        feedView: currentFeedView
      })
    });
  if (overviewHeadline) overviewHeadline.textContent = `Saved temporal view: ${name}`;
    await loadIntel();
  });
}

if (copyShareLinkButton) {
  copyShareLinkButton.addEventListener('click', async () => {
    const url = buildShareUrl();
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
  if (overviewHeadline) overviewHeadline.textContent = 'Copied intel share link to clipboard.';
        return;
      }
    } catch (error) {
      console.error(error);
    }

    window.prompt('Copy this intel share link', url);
  });
}

if (baselineModeSelect) {
  baselineModeSelect.addEventListener('change', async () => {
    currentBaselineMode = baselineModeSelect.value || 'previous';
    syncBaselineControls();
  if (overviewHeadline) overviewHeadline.textContent = currentBaselineMode === 'saved'
      ? 'Baseline mode set to saved temporal view.'
      : 'Baseline mode set to previous window.';
    await loadIntel();
  });
}

if (baselineViewSelect) {
  baselineViewSelect.addEventListener('change', async () => {
    currentBaselineViewId = baselineViewSelect.value || '';
    syncBaselineControls();
    if (currentBaselineMode === 'saved') {
  if (overviewHeadline) overviewHeadline.textContent = currentBaselineViewId
        ? 'Saved baseline selected.'
        : 'Choose a saved view for baseline comparison.';
      await loadIntel();
    }
  });
}

if (baselineDriftHistory) {
  baselineDriftHistory.addEventListener('click', async (event) => {
    const chip = event.target.closest('[data-baseline-history-index]');
    if (!chip) return;
    const entry = readBaselineHistory()[Number(chip.dataset.baselineHistoryIndex || -1)];
    if (!entry) return;

    currentTimelineFilter = entry.anchorTime || null;
    currentTimelineWindowMinutes = Number(entry.windowMinutes || 60);
    currentSeverityFilter = entry.severityFilter || null;
    currentSourceFilter = entry.sourceFilter || null;
    currentRecoveredFilter = Boolean(entry.recoveredFilter);
    currentFeedView = entry.feedView || 'active';
    currentBaselineMode = entry.baselineMode || 'previous';
    currentBaselineViewId = entry.baselineViewId || '';

    syncTimelineWindowButtons();
    syncSeverityFilterButtons();
    syncFeedViewButtons();
    syncBaselineControls();
  if (overviewHeadline) overviewHeadline.textContent = `Restored baseline history snapshot: ${entry.label}`;
    await loadIntel();
  });
}

if (baselineRecommendationActions) {
  baselineRecommendationActions.addEventListener('click', async (event) => {
    const chip = event.target.closest('[data-baseline-recommendation]');
    if (!chip) return;
    const action = chip.dataset.baselineRecommendation;
    await fetchJson('api/baseline-recommendation-accept.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });
    setSelected({ suggestedQuery: action, topic: 'Baseline Recommendation', thirdOrderEscalationAction: 'recommended next step' });
  if (overviewHeadline) overviewHeadline.textContent = `Recommended baseline action: ${action}`;
    await loadIntel();
  });
}

if (baselineRecommendationOutcomes) {
  baselineRecommendationOutcomes.addEventListener('click', async (event) => {
    const chip = event.target.closest('[data-recommendation-outcome-action]');
    if (!chip) return;
    const action = chip.dataset.recommendationOutcomeAction;
    const outcome = chip.dataset.recommendationOutcome;
    await fetchJson('api/baseline-recommendation-outcome.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, outcome })
    });
  if (overviewHeadline) overviewHeadline.textContent = `Recorded recommendation outcome: ${action} · ${outcome}`;
    const refreshedRecommendations = (await fetchJson('api/baseline-recommendations.php')).items || [];
    const refreshedPrioritySummary = await fetchJson('api/baseline-recommendation-priority.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: refreshedRecommendations })
    });
    await fetchJson('api/baseline-recommendation-churn-track.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: refreshedPrioritySummary.items || [] })
    });
    await fetchJson('api/baseline-recommendation-confidence-track.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: refreshedPrioritySummary.items || [] })
    });
    renderBaselineRecommendations(refreshedPrioritySummary.visibleItems || refreshedPrioritySummary.items || []);
    if (typeof initOrUpdateGlobe === "function") initOrUpdateGlobe(refreshedPrioritySummary.items || []);
    renderBaselineRecommendationPriority(refreshedPrioritySummary || {});
    renderBaselineRecommendationSuppressed(refreshedPrioritySummary.suppressedItems || []);
    renderBaselineRecommendationRevived(refreshedPrioritySummary.revivedItems || []);
    renderBaselineRecommendationStable(refreshedPrioritySummary.stableItems || []);
    renderBaselineRecommendationConfidence(refreshedPrioritySummary.visibleItems || refreshedPrioritySummary.items || []);
    renderBaselineRecommendationConfidenceTrend(await fetchJson('api/baseline-recommendation-confidence-trend.php'));
    renderBaselineRecommendationConfidenceVolatility(await fetchJson('api/baseline-recommendation-confidence-volatility.php'));
    renderBaselineRecommendationConfidenceResilience(refreshedPrioritySummary.visibleItems || refreshedPrioritySummary.items || []);
    renderBaselineRecommendationConfidenceAdjustments(await fetchJson('api/baseline-recommendation-confidence-adjustments.php'));
    renderBaselineRecommendationTrustMomentum(await fetchJson('api/baseline-recommendation-trust-momentum.php'));
    renderBaselineRecommendationRevivalAnalytics(await fetchJson('api/baseline-recommendation-revival-analytics.php'));
    renderBaselineRecommendationChurn(await fetchJson('api/baseline-recommendation-churn.php'));
    renderBaselineRecommendationOutcomes(await fetchJson('api/baseline-recommendation-outcomes.php'));
    renderBaselineRecommendationPlaybook(await fetchJson('api/baseline-recommendation-playbook.php'));
  });
}

if (baselineHistoryHealth) {
  baselineHistoryHealth.addEventListener('click', async (event) => {
    const chip = event.target.closest('[data-history-health-action]');
    if (!chip) return;
    const action = chip.dataset.historyHealthAction;

    if (action === 'prune-flat-runs' || action === 'archive-stale-history') {
      const result = await fetchJson('api/baseline-history-maintenance.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      if (Array.isArray(result.items)) {
        writeBaselineHistory(result.items);
      }
  if (overviewHeadline) overviewHeadline.textContent = `Executed history maintenance: ${action}`;
      await loadIntel();
      return;
    }

    setSelected({ suggestedQuery: action, topic: 'History Health', thirdOrderEscalationAction: 'health guidance' });
  if (overviewHeadline) overviewHeadline.textContent = `History health suggestion: ${action}`;
  });
}

if (timelineViewsList) {
  timelineViewsList.addEventListener('click', async (event) => {
    const deleteButton = event.target.closest('[data-delete-timeline-view-id]');
    if (deleteButton) {
      await fetchJson(`api/timeline-views.php?id=${encodeURIComponent(deleteButton.dataset.deleteTimelineViewId)}`, {
        method: 'DELETE'
      });
  if (overviewHeadline) overviewHeadline.textContent = 'Deleted saved temporal view.';
      await loadIntel();
      return;
    }

    const viewButton = event.target.closest('[data-timeline-view-id]');
    if (!viewButton) return;
    const view = currentTimelineViews.find((item) => item.id === viewButton.dataset.timelineViewId);
    if (!view) return;

    currentTimelineFilter = view.anchorTime || null;
    currentTimelineWindowMinutes = Number(view.windowMinutes || 60);
    currentSeverityFilter = view.severityFilter || null;
    currentSourceFilter = view.sourceFilter || null;
    currentRecoveredFilter = Boolean(view.recoveredFilter);
    currentFeedView = view.feedView || 'active';

    syncTimelineWindowButtons();
    syncSeverityFilterButtons();
    syncFeedViewButtons();
    setSelected({ suggestedQuery: formatTimelineViewName(view), topic: 'Saved Temporal View', thirdOrderEscalationAction: 'restored saved scope' });
  if (overviewHeadline) overviewHeadline.textContent = `Restored temporal view: ${formatTimelineViewName(view)}`;
    await loadIntel();
  });
}

signalRecoveryAnalyticsCard?.addEventListener('click', async (event) => {
  const btn = event.target.closest('[data-signal-recovered]');
  if (!btn) {
    if (currentRecoveredFilter) {
      currentRecoveredFilter = false;
  if (overviewHeadline) overviewHeadline.textContent = 'Showing all signals.';
      await loadIntel();
    }
    return;
  }
  currentRecoveredFilter = true;
  currentTimelineFilter = null;
  setSelected({ suggestedQuery: 'Recovered Signals', topic: 'Analytics', thirdOrderEscalationAction: 'filtering feed by recovery' });
  if (overviewHeadline) overviewHeadline.textContent = `Live feed isolated to recovered signals`;
  await loadIntel();
});

taskContextAnalyticsCard?.addEventListener('click', async (event) => {
  const btn = event.target.closest('[data-task-tag]');
  if (!btn) {
    if (currentTagFilter !== null || currentTaskIdFilter !== null) {
      currentTagFilter = null;
      currentTaskIdFilter = null;
  if (overviewHeadline) overviewHeadline.textContent = 'Showing all task contexts.';
      await loadIntel();
    }
    return;
  }
  const tag = btn.dataset.taskTag;
  currentTagFilter = tag;
  currentTaskIdFilter = null;
  setSelected({ suggestedQuery: `Tag: ${tag}`, topic: 'Mission Focus', thirdOrderEscalationAction: 'filtering feed by task' });
  if (overviewHeadline) overviewHeadline.textContent = `Live feed filtered to ${tag} operations`;
  await loadIntel();
});

taskSignalCorrelationCard?.addEventListener('click', async (event) => {
  const btn = event.target.closest('[data-task-focus-id]');
  if (!btn) {
    if (currentTagFilter !== null || currentTaskIdFilter !== null) {
      currentTagFilter = null;
      currentTaskIdFilter = null;
  if (overviewHeadline) overviewHeadline.textContent = 'Showing all task contexts.';
      await loadIntel();
    }
    return;
  }
  const taskId = btn.dataset.taskFocusId;
  const taskName = btn.dataset.taskName;
  currentTaskIdFilter = taskId;
  currentTagFilter = null;
  currentTimelineFilter = null;
  setSelected({ suggestedQuery: `Task: ${taskId}`, topic: 'Task Signal Flow', thirdOrderEscalationAction: `monitoring ${taskName}` });
  if (overviewHeadline) overviewHeadline.textContent = `Live feed isolated to: ${taskName}`;
  await loadIntel();
});

signalEscalationAnalyticsList?.addEventListener('click', async (event) => {
  const chip = event.target.closest('[data-signal-analytics]');
  if (!chip) {
    if (currentSourceFilter !== null) {
      currentSourceFilter = null;
  if (overviewHeadline) overviewHeadline.textContent = 'Showing all signal sources.';
      await loadIntel();
    }
    return;
  }
  const source = chip.dataset.signalAnalytics;
  currentSourceFilter = source;
  currentTimelineFilter = null;
  setSelected({ suggestedQuery: `Source: ${source}`, topic: 'Analytics', thirdOrderEscalationAction: 'filtering feed' });
  if (overviewHeadline) overviewHeadline.textContent = `Live feed filtered to ${source}`;
  await loadIntel();
});

if (timelineComparisonSummary) {
  timelineComparisonSummary.addEventListener('click', async (event) => {
    const chip = event.target.closest('[data-compare-source]');
    if (!chip) return;
    currentSourceFilter = chip.dataset.compareSource;
  if (overviewHeadline) overviewHeadline.textContent = `Comparison scoped to source: ${currentSourceFilter}`;
    await loadIntel();
  });
}

signalFeedList?.addEventListener('click', async (event) => {
  const scoreBtn = event.target.closest('[data-signal-score]');
  if (scoreBtn) {
    const id = scoreBtn.dataset.signalId;
    const outcome = scoreBtn.dataset.signalScore;
    
    await fetchJson('api/signal-escalation-score.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, outcome })
    });
    
    await loadIntel();
    return;
  }

  const btn = event.target.closest('[data-signal-action]');
  if (!btn) return;
  const id = btn.dataset.signalId;
  const action = btn.dataset.signalAction;

  if (action === 'escalate') {
    const itemEl = btn.closest('.signal-item');
    const title = itemEl.querySelector('.signal-title').textContent;
    const source = itemEl.querySelector('.muted').textContent;
    setSelected({ suggestedQuery: `Signal: ${id}`, topic: source, thirdOrderEscalationAction: 'escalated to focus' });
  if (overviewHeadline) overviewHeadline.textContent = title;
  }
  
  await fetchJson('api/signal-action.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, action })
  });
  
  await loadIntel();
});

recommendationsList?.addEventListener('click', async (event) => {
  const reviewButton = event.target.closest('[data-third-order-review]');
  if (reviewButton) {
    const item = JSON.parse(reviewButton.dataset.thirdOrderReview.replace(/&apos;/g, "'"));
    await fetchJson('api/third-order-escalation-record-accept.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item)
    });
    setSelected(item);
    await loadIntel();
    return;
  }

  const focusButton = event.target.closest('[data-third-order-focus]');
  if (!focusButton) return;
  const item = JSON.parse(focusButton.dataset.thirdOrderFocus.replace(/&apos;/g, "'"));
  setSelected(item);
});

analyticsList?.addEventListener('click', async (event) => {
  const chip = event.target.closest('[data-third-order-analytics]');
  if (!chip) return;
  const item = JSON.parse(chip.dataset.thirdOrderAnalytics.replace(/&apos;/g, "'"));
  setSelected(item);
});

effectivenessList?.addEventListener('click', async (event) => {
  const chip = event.target.closest('[data-third-order-effectiveness]');
  if (!chip) return;
  const item = JSON.parse(chip.dataset.thirdOrderEffectiveness.replace(/&apos;/g, "'"));
  setSelected(item);
});

// ── Boot sequence ──
function safeCall(fn, label) {
  try { fn(); console.log('[Intel] ✅', label); }
  catch(e) { console.error('[Intel] ❌', label, e.message); }
}
safeCall(initializeStateFromUrl, 'initializeStateFromUrl');
safeCall(syncTimelineWindowButtons, 'syncTimelineWindowButtons');
safeCall(syncSeverityFilterButtons, 'syncSeverityFilterButtons');
safeCall(syncFeedViewButtons, 'syncFeedViewButtons');
safeCall(syncBaselineControls, 'syncBaselineControls');
safeCall(renderBaselineHistory, 'renderBaselineHistory');
safeCall(initializeCommandSurface, 'initializeCommandSurface');

loadIntel().then(() => startAutoRefresh()).catch(e => console.error('[Intel] loadIntel failed:', e));

function getStructuralStateCounts(items = []) {
  return items.reduce((acc, item) => {
    const state = item.recoveryTrustDriverTransitionBalanceStructuralState || 'neutral';
    acc[state] = (acc[state] || 0) + 1;
    if (item.recoveryTrustDriverTransitionBalanceJustReversed || item.trustMomentumJustReversed) {
      acc.reversals += 1;
    }
    return acc;
  }, { terminal: 0, compromised: 0, weakening: 0, contested: 0, sound: 0, fortified: 0, neutral: 0, reversals: 0 });
}

function renderCommandBar(items = []) {
  const counts = getStructuralStateCounts(items);
  const posture = counts.terminal > 0
    ? 'critical'
    : counts.compromised > 0 || counts.weakening > 0
      ? 'contested'
      : counts.fortified > 0
        ? 'stable'
        : 'watch';

  const postureEl = document.getElementById('global-posture');
  const terminalEl = document.getElementById('terminal-count');
  const fortifiedEl = document.getElementById('fortified-count');
  const reversalEl = document.getElementById('reversal-count');
  const statusPostureEl = document.getElementById('status-strip-posture');
  const statusTerminalEl = document.getElementById('status-strip-terminal');
  const statusFortifiedEl = document.getElementById('status-strip-fortified');

  if (postureEl) postureEl.textContent = posture;
  if (terminalEl) terminalEl.textContent = String(counts.terminal || 0);
  if (fortifiedEl) fortifiedEl.textContent = String(counts.fortified || 0);
  if (reversalEl) reversalEl.textContent = String(counts.reversals || 0);
  if (statusPostureEl) {
  if (statusPostureEl) statusPostureEl.textContent = posture;
    statusPostureEl.dataset.tone = posture === 'critical' ? 'critical' : posture === 'stable' ? 'stable' : 'watch';
  }
  if (statusTerminalEl) {
  if (statusTerminalEl) statusTerminalEl.textContent = String(counts.terminal || 0);
    statusTerminalEl.dataset.tone = counts.terminal > 0 ? 'critical' : 'neutral';
  }
  if (statusFortifiedEl) {
  if (statusFortifiedEl) statusFortifiedEl.textContent = String(counts.fortified || 0);
    statusFortifiedEl.dataset.tone = counts.fortified > 0 ? 'stable' : 'neutral';
  }
}

function setDiagnosticsVisible(visible) {
  diagnosticsVisible = visible;
  const ids = [
    'timeline-views-list',
    'task-context-analytics-card',
    'task-retention-analytics-card',
    'task-signal-correlation-card',
    'signal-action-analytics-card',
    'signal-escalation-analytics-list',
    'third-order-escalation-dashboard-card',
    'third-order-escalation-recommendations-list',
    'third-order-escalation-analytics-list',
    'third-order-escalation-effectiveness-list',
    'timeline-container',
    'timeline-focus-status',
    'feed-window-summary',
    'timeline-comparison-summary',
    'baseline-shift-summary',
    'baseline-drift-history',
    'baseline-performance-summary',
    'baseline-trend-summary',
    'baseline-history-health',
    'baseline-recommendation-actions',
    'baseline-recommendation-analytics',
    'baseline-recommendation-effectiveness',
    'baseline-recommendation-priority',
    'baseline-recommendation-outcomes',
    'baseline-recommendation-suppressed',
    'baseline-recommendation-revived',
    'baseline-recommendation-revival-analytics',
    'baseline-recommendation-churn',
    'baseline-recommendation-stable',
    'baseline-recommendation-confidence',
    'baseline-recommendation-confidence-trend',
    'baseline-recommendation-confidence-volatility',
    'baseline-recommendation-confidence-resilience',
    'baseline-recommendation-confidence-adjustments',
    'baseline-recommendation-trust-momentum',
    'baseline-recommendation-playbook',
    'baseline-maintenance-analytics',
    'baseline-maintenance-effectiveness',
    'signal-feed-list'
  ];

  ids.forEach((id) => {
    const node = document.getElementById(id);
    const card = node?.closest('.stage-card, .panel');
    if (card) card.classList.toggle('diagnostic-hidden', !visible);
  });

  const modalOverlay = document.getElementById('diagnostics-modal-overlay');
  if (modalOverlay) {
    modalOverlay.style.display = visible ? 'flex' : 'none';
    document.body.style.overflow = visible ? 'hidden' : '';
  }

  const toggleButton = document.getElementById('toggle-diagnostics');
  if (toggleButton) toggleButton.textContent = visible ? 'Hide diagnostics' : 'Show diagnostics';
}

function closeIntelDrawer() {
  const drawer = document.getElementById('intel-activation-panel');
  if (!drawer) return;
  drawer.classList.remove('visible');
  drawer.setAttribute('aria-hidden', 'true');
  setDrawerImage(null);
  
  if (selectedAirIcao24) {
      selectedAirIcao24 = null;
      if (typeof initOrUpdateGlobe === "function") initOrUpdateGlobe(currentGlobeBaseItems || []);
      if (typeof updateDataPanel === 'function') updateDataPanel();
  }
}


function getSeaFlagCode(country) {
    const map = {
        'USA': 'us',
        'Panama': 'pa',
        'Liberia': 'lr',
        'Marshall Islands': 'mh',
        'Hong Kong': 'hk',
        'Singapore': 'sg',
        'Malta': 'mt',
        'Bahamas': 'bs',
        'Saudi Arabia': 'sa',
        'Iran': 'ir',
        'UAE': 'ae',
        'Mexico': 'mx'
    };
    return map[country] || null;
}

function openIntelDrawer(item = {}) {
  const drawer = document.getElementById('intel-activation-panel');
  if (!drawer) return;

  const airlineLogoEl = document.getElementById('intel-drawer-airline-logo');
  if (airlineLogoEl) { 
      airlineLogoEl.style.display = 'none'; 
      airlineLogoEl.src = ''; 
      airlineLogoEl.style.borderRadius = '0';
      airlineLogoEl.style.border = 'none';
  }

  const state = item.recoveryTrustDriverTransitionBalanceStructuralState || 'neutral';
  const title = item.locationName || item.action || item.name || 'Activated point';
  const summary = item.reason
    || `${item.action || 'Recommendation'} is currently ${state} with ${item.trustMomentumBand || 'neutral'} momentum.`;
  const crimeScan = cityCrimeScans[item.locationName] || null;

  const titleEl = document.getElementById('intel-drawer-title');
  const stateEl = document.getElementById('intel-drawer-state');
  const summaryEl = document.getElementById('intel-drawer-summary');
  const mapEl = document.getElementById('intel-drawer-map');
  const metricsEl = document.getElementById('intel-drawer-metrics');
  const deepEl = document.getElementById('intel-drawer-deep');
  setDrawerImage(null);

  if (item.kind === 'sea') {
    const v = item.raw;
    if (titleEl) titleEl.textContent = v.name || 'Maritime Vessel';
    if (stateEl) {
      stateEl.textContent = 'transmitting';
      stateEl.style.borderColor = '#0096ff';
      stateEl.style.color = '#0096ff';
    }
    if (summaryEl) summaryEl.textContent = `Type: ${v.type} | Flag: ${v.flag}`;
    
    if (airlineLogoEl && v.flag) {
        const code = getSeaFlagCode(v.flag);
        if (code) {
            airlineLogoEl.src = `https://flagcdn.com/w160/${code}.png`;
            airlineLogoEl.style.display = 'block';
            airlineLogoEl.style.borderRadius = '3px';
            airlineLogoEl.style.border = '1px solid rgba(255,255,255,0.1)';
        }
    }
    
    if (mapEl) {
      mapEl.innerHTML = `
        <div style="padding:16px;">
          <div style="font-family:var(--font-mono); font-size:12px; color:#fff; margin-bottom:8px;">Speed: <span style="color:#0096ff">${v.speedKnots} kts</span></div>
          <div style="font-family:var(--font-mono); font-size:12px; color:#fff; margin-bottom:8px;">Heading: <span style="color:#0096ff">${v.heading}°</span></div>
          <div style="font-family:var(--font-mono); font-size:12px; color:#fff; margin-bottom:8px;">Destination: <span style="color:orange">${v.destination || 'Unknown'}</span></div>
          <div style="font-family:var(--font-mono); font-size:12px; color:#fff;">MMSI: <span style="color:#888">${v.id}</span></div>
        </div>
      `;
    }
  } else if (item.kind === 'graph-node') {
    const node = item.node;
    if (titleEl) titleEl.textContent = node.label || 'Ontology Node';
    if (stateEl) {
      stateEl.textContent = 'linked';
      stateEl.style.borderColor = '#00e5ff';
      stateEl.style.color = '#00e5ff';
    }
    if (summaryEl) {
       summaryEl.innerHTML = `Graph Entity (Group ${node.group})` + (node.url ? `<br><br><a href="${node.url}" target="_blank" rel="noopener noreferrer" style="color:#00e5ff; text-decoration:underline; font-size:13px; font-weight:bold;">→ View Source Article</a>` : '');
    }
    setDrawerImage(node.image || null, node.label);
    
    if (mapEl) {
      mapEl.innerHTML = `<div class="task-focus-meta" style="padding:16px;">Node is currently focused on the Link Graph canvas.</div>`;
    }
    
    if (metricsEl) {
      let relHtml = '';
      if (item.related && item.related.length > 0) {
        relHtml = item.related.map(r => `
          <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:12px; align-items:center; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:6px;">
            <div style="color:#fff; flex-grow:1; word-break:break-word; padding-right:12px;">${r.label || r.id}</div>
            <div style="color:var(--lime); text-transform:uppercase; font-size:9px; letter-spacing:0.05em; background:rgba(210,255,84,0.1); padding:2px 4px; border-radius:3px;">LINKED</div>
          </div>
        `).join('');
      } else {
        relHtml = '<div class="muted">No direct links found.</div>';
      }
      
      metricsEl.innerHTML = `
        <div style="font-family:var(--font-mono); text-transform:uppercase; font-size:10px; color:var(--lime); margin-bottom:12px; letter-spacing:0.05em; border-bottom:1px solid var(--border); padding-bottom:6px;">Direct Relationships</div>
        ${relHtml}
      `;
    }
    
    if (deepEl) deepEl.innerHTML = '';
    if (selectedQuery) selectedQuery.textContent = node.label || 'Entity Node';
    if (selectedMeta) selectedMeta.textContent = `${item.related?.length || 0} connections established`;
    
    drawer.classList.add('visible');
    drawer.setAttribute('aria-hidden', 'false');
    return;
  }

  if (item.kind === 'air') {
    const aircraftTitle = item.callsign || 'Tracked aircraft';
    if (titleEl) titleEl.textContent = aircraftTitle;
    if (stateEl) {
  if (stateEl) stateEl.textContent = 'airborne';
      stateEl.style.borderColor = '#d2ff54';
      stateEl.style.color = '#d2ff54';
    }
    if (summaryEl) summaryEl.textContent = `${item.country || 'Public air traffic'} flight currently mapped in the live Air layer.`;
    if (mapEl) {
  if (mapEl) mapEl.innerHTML = `<div class="task-focus-meta" style="padding:16px;">Aircraft position and projected path are active on the globe stage.</div>`;
    }
    if (metricsEl) {
  if (metricsEl) metricsEl.innerHTML = [
        ['Flight', aircraftTitle],
        ['Airline', 'Loading…'],
        ['Departure', 'Loading…'],
        ['Destination', 'Loading…'],
        ['Departure time', 'Loading…'],
        ['Arrival time', 'Loading…']
      ].map(([label, value]) => `
        <div class="intel-mini">
          <div class="intel-mini-label">${label}</div>
          <div class="intel-mini-value">${value}</div>
        </div>
      `).join('');
    }
    if (deepEl) {
  if (deepEl) deepEl.innerHTML = [
        `altitude ${item.altitude ?? 'n/a'} m`,
        `speed ${item.velocity != null ? `${item.velocity} m/s` : 'n/a'}`,
        `heading ${item.heading != null ? `${item.heading}°` : 'n/a'}`,
        `icao24 ${item.icao24 || 'n/a'}`,
        `source OpenSky Network public states`
      ].map((line) => `<div style="margin-bottom:8px; word-break:break-all;">${line}</div>`).join('');
    }
    if (selectedQuery) if (selectedQuery) selectedQuery.textContent = aircraftTitle;
    if (selectedMeta) selectedMeta.textContent = `${item.country || 'Public traffic'} · airborne`;
    drawer.classList.add('visible');
    drawer.setAttribute('aria-hidden', 'false');

    fetchFlightDetail(item.callsign).then((detail) => {
      if (!detail || titleEl?.textContent !== aircraftTitle) return;
      // Fetch airline logo
      if (airlineLogoEl && detail.airline) {
        fetch(`api/airline-logos.php?callsign=${encodeURIComponent(item.callsign || '')}&airline=${encodeURIComponent(detail.airline)}&w=120&h=48`)
          .then(r => r.json())
          .then(logoData => {
            if (logoData?.logoUrl) {
              airlineLogoEl.src = logoData.logoUrl;
              airlineLogoEl.style.display = 'block';
              airlineLogoEl.onerror = () => {
                // Try local SVG fallback if external logo 404s
                const fallback = `airline-logos/${logoData.iata}.svg`;
                if (airlineLogoEl.src !== fallback && logoData.iata) {
                  airlineLogoEl.src = fallback;
                } else {
                  airlineLogoEl.style.display = 'none';
                }
              };
            }
          })
          .catch(() => {});
      }
      if (summaryEl) {
  if (summaryEl) summaryEl.textContent = `${detail.airline || item.country || 'Public air traffic'} ${detail.flightNumber || aircraftTitle} from ${detail.departure?.location || detail.departure?.iata || 'unknown departure'} to ${detail.destination?.location || detail.destination?.iata || 'unknown destination'}.`;
      }
      if (metricsEl) {
  if (metricsEl) metricsEl.innerHTML = [
          ['Flight', detail.flightNumber || aircraftTitle],
          ['Airline', detail.airline || 'Unknown'],
          ['Departure', [detail.departure?.iata, detail.departure?.location].filter(Boolean).join(' · ') || 'Unknown'],
          ['Destination', [detail.destination?.iata, detail.destination?.location].filter(Boolean).join(' · ') || 'Unknown'],
          ['Departure time', detail.times?.departureEstimated || detail.times?.departureScheduled || detail.times?.departureActual || 'Unknown'],
          ['Arrival time', detail.times?.arrivalEstimated || detail.times?.arrivalScheduled || detail.times?.arrivalActual || 'Unknown']
        ].map(([label, value]) => `
          <div class="intel-mini">
            <div class="intel-mini-label">${label}</div>
            <div class="intel-mini-value">${value}</div>
          </div>
        `).join('');
      }
      if (deepEl) {
  if (deepEl) deepEl.innerHTML = [
          `flight time ${detail.flightTime || 'Unknown'}`,
          `aircraft ${detail.aircraftType || 'Unknown'}`,
          `scheduled departure ${detail.times?.departureScheduled || 'Unknown'}`,
          `scheduled arrival ${detail.times?.arrivalScheduled || 'Unknown'}`,
          `actual departure ${detail.times?.departureActual || 'Unknown'}`,
          `actual arrival ${detail.times?.arrivalActual || 'Unknown'}`
        ].map((line) => `<div style="margin-bottom:8px; word-break:break-all;">${line}</div>`).join('');
      }
      if (selectedMeta) selectedMeta.textContent = `${detail.airline || item.country || 'Public traffic'} · ${detail.flightTime || 'time unknown'}`;
    }).catch(() => {});
    return;
  }

  if (item.kind === 'satellite') {
    if (titleEl) titleEl.textContent = item.name || 'Satellite';
    if (stateEl) {
  if (stateEl) stateEl.textContent = 'tracking';
      stateEl.style.borderColor = '#ffd166';
      stateEl.style.color = '#ffd166';
    }
    if (summaryEl) summaryEl.textContent = `${item.network || 'Public catalog'} satellite in ${item.orbitClass || 'tracked'} orbit.`;
    setDrawerImage(getSatellitePreviewImage(item), `${item.name || 'Satellite'} preview`);
    if (mapEl) {
  if (mapEl) mapEl.innerHTML = `<div class="task-focus-meta" style="padding:16px;">Satellite position is live on the globe stage. Click-and-drag the globe to inspect surrounding orbital traffic.</div>`;
    }
    if (metricsEl) {
  if (metricsEl) metricsEl.innerHTML = [
        ['Name', item.name || 'Unknown'],
        ['Network', item.network || 'Public catalog'],
        ['Orbit', item.orbitClass || 'Tracked'],
        ['Altitude', `${item.liveAltitudeKm ?? item.altitudeKm ?? 'n/a'} km`],
        ['Inclination', `${item.inclination ?? 'n/a'}°`],
        ['Period', `${item.periodMinutes ?? 'n/a'} min`]
      ].map(([label, value]) => `
        <div class="intel-mini">
          <div class="intel-mini-label">${label}</div>
          <div class="intel-mini-value">${value}</div>
        </div>
      `).join('');
    }
    if (deepEl) {
  if (deepEl) deepEl.innerHTML = [
        `NORAD ${item.noradId || 'unknown'}`,
        `TLE line 1 ${item.tle1 || 'n/a'}`,
        `TLE line 2 ${item.tle2 || 'n/a'}`
      ].map((line) => `<div style="margin-bottom:8px; word-break:break-all;">${line}</div>`).join('');
    }
    if (selectedQuery) if (selectedQuery) selectedQuery.textContent = item.name || 'Satellite';
    if (selectedMeta) selectedMeta.textContent = `${item.network || 'Public catalog'} · ${item.orbitClass || 'Tracked'} orbit`;
    drawer.classList.add('visible');
    drawer.setAttribute('aria-hidden', 'false');
    return;
  }

  if (item.kind === 'threat') {
    const threatType = item.type || 'Cyber Threat';
    const threatCountry = item.country || 'Unknown';
    const threatCount = item.count || 1;
    if (titleEl) titleEl.textContent = threatCountry;
    if (stateEl) {
  if (stateEl) stateEl.textContent = 'threat';
      stateEl.style.borderColor = '#ff3333';
      stateEl.style.color = '#ff3333';
    }
    if (summaryEl) summaryEl.textContent = `${threatCount} threat${threatCount > 1 ? 's' : ''} detected originating from ${threatCountry}.`;
    setDrawerImage(null);
    if (mapEl) {
  if (mapEl) mapEl.innerHTML = `<div class="task-focus-meta" style="padding:16px;">Threat source is highlighted on the globe. Click-and-drag to inspect surrounding threat activity.</div>`;
    }
    if (metricsEl) {
  if (metricsEl) metricsEl.innerHTML = [
        ['Country', threatCountry],
        ['Threats', threatCount],
        ['Source', 'Honeypot Network'],
        ['Status', 'Active monitoring'],
        ['Risk Level', threatCount > 10 ? 'High' : threatCount > 5 ? 'Medium' : 'Low']
      ].map(([label, value]) => `
        <div class="intel-mini">
          <div class="intel-mini-label">${label}</div>
          <div class="intel-mini-value">${value}</div>
        </div>
      `).join('');
    }
    if (deepEl) deepEl.innerHTML = '';
    if (selectedQuery) if (selectedQuery) selectedQuery.textContent = threatCountry;
    if (selectedMeta) selectedMeta.textContent = `${threatCount} threats · ${threatType}`;
    drawer.classList.add('visible');
    drawer.setAttribute('aria-hidden', 'false');
    return;
  }

  if (titleEl) titleEl.textContent = title;
  if (stateEl) {
  if (stateEl) stateEl.textContent = state;
    stateEl.style.borderColor = stateColors[state] || 'var(--border)';
    stateEl.style.color = stateColors[state] || 'var(--text)';
  }
  if (summaryEl) summaryEl.textContent = summary;
  if (mapEl) {
  if (mapEl) mapEl.innerHTML = typeof item.lat === 'number' && typeof item.lng === 'number'
      ? `<div class="task-focus-meta" style="padding:16px;">City map view is now active in the main globe stage.${crimeScan ? ` Crime scan: ${crimeScan.incidents} incidents across ${crimeScan.hotspots} police zones.` : ''}</div>`
      : '<div class="task-focus-meta" style="padding:16px;">Map view unavailable for this location.</div>';
  }
  if (metricsEl) {
  if (metricsEl) metricsEl.innerHTML = [
      ['Action', item.action || 'Unknown'],
      ['Priority', item.priorityScore ?? 'n/a'],
      ['Momentum', item.trustMomentumBand || 'neutral'],
      ['Location', item.locationName || 'Unmapped'],
      ['Police zones', crimeScan?.hotspots ?? 'n/a'],
      ['Crime incidents', crimeScan?.incidents ?? 'n/a']
    ].map(([label, value]) => `
      <div class="intel-mini">
        <div class="intel-mini-label">${label}</div>
        <div class="intel-mini-value">${value}</div>
      </div>
    `).join('');
  }
  if (deepEl) {
  if (deepEl) deepEl.innerHTML = [
      `confidence ${item.confidenceBand || 'unknown'}`,
      `outcome ${item.outcomeScore ?? 0}`,
      `upgrades ${item.upgradedCount || 0}`,
      `downgrades ${item.downgradedCount || 0}`,
      `transition balance ${item.recoveryTrustDriverTransitionBalanceBand || 'balanced'} ${item.recoveryTrustDriverTransitionBalanceScore || 0}`,
      `structural adjustment ${item.recoveryTrustDriverTransitionBalanceStructuralAdjustment || 0}`
    ].map((line) => `<div style="margin-bottom:8px;">${line}</div>`).join('');
  }

  if (selectedQuery) if (selectedQuery) selectedQuery.textContent = title;
  if (selectedMeta) selectedMeta.textContent = summary;

  drawer.classList.add('visible');
  drawer.setAttribute('aria-hidden', 'false');

  if (typeof item.lat === 'number' && typeof item.lng === 'number') {
    showMapStage(item);
  }
}

function initializeLayerConfigurator() {
  const currentLayerCard = document.getElementById('current-layer-card');
  if (!currentLayerCard || currentLayerCard.dataset.layerConfigReady === '1') return;

  const layerOptions = [...currentLayerCard.querySelectorAll('.plain-list li')].map((node) => node.textContent.trim()).filter(Boolean);
  if (!layerOptions.length) return;

  const storageKey = 'jk-intel-active-layers-v1';
  const defaultLayers = [
    'Geographic Intel Projection (Global mapping)',
    'Recovery-trust driver transition balance structural state classification',
    'Recommendation priority scoring',
    'Recommendation confidence bands',
    'Trust momentum reversal detection',
    'Baseline shift scoring'
  ].filter((label) => layerOptions.includes(label));

  let activeLayers;
  try {
    const saved = JSON.parse(window.localStorage.getItem(storageKey) || 'null');
    activeLayers = Array.isArray(saved) && saved.length ? saved.filter((label) => layerOptions.includes(label)) : defaultLayers;
  } catch {
    activeLayers = defaultLayers;
  }
  if (currentLayerCard) currentLayerCard.innerHTML = `
    <div class="panel-kicker">Systems Online</div>
    <button id="systems-online-count" class="big-query systems-online-count">0</button>
    <div class="muted" style="margin-top:12px;">Click the number to configure which systems read as active in the surface.</div>
    <div id="active-layer-box" class="active-layer-box"></div>
    <div class="layer-card-actions">
      <button id="reset-layer-modal" class="ghost-btn">Reset defaults</button>
    </div>
  `;

  const modal = document.createElement('div');
  modal.id = 'layer-modal';
  modal.className = 'intel-modal';
  modal.innerHTML = `
    <div class="intel-modal-card">
      <div class="intel-drawer-head">
        <div>
          <div class="panel-kicker">Systems Online</div>
          <div class="intel-drawer-title">Choose active systems</div>
        </div>
        <button id="close-layer-modal" class="ghost-btn">X</button>
      </div>
      <div class="muted" style="margin-top:12px;">This is a presentation lens. Toggle the tags you want surfaced in the active box.</div>
      <div id="layer-modal-tags" class="layer-option-grid"></div>
    </div>
  `;
  document.body.appendChild(modal);

  const activeLayerBox = document.getElementById('active-layer-box');
  const modalTags = document.getElementById('layer-modal-tags');
  const categoryOrder = ['Recommendations', 'Scoring', 'Tracking', 'Monitoring', 'Filtering', 'Timeline', 'Recovery', 'Analytics', 'Controls', 'Mapping', 'Operations'];

  function categorizeLayer(label) {
    if (/recommendation|playbook|promotion|suppression|revived|guidance/i.test(label)) return 'Recommendations';
    if (/scor|grade|boost|penalt|priority/i.test(label)) return 'Scoring';
    if (/track|history|trend|streak|drift|convergence|durability/i.test(label)) return 'Tracking';
    if (/monitor|live|feed|alert|health|summary|online/i.test(label)) return 'Monitoring';
    if (/filter|scope|selected|source|severity|comparison mode/i.test(label)) return 'Filtering';
    if (/timeline|temporal|window|view|restore|shareable/i.test(label)) return 'Timeline';
    if (/recovery|trust|resilience|maturity|recapture|entrenchment|structural state/i.test(label)) return 'Recovery';
    if (/analytic|analytics|dashboard|correlation|motion/i.test(label)) return 'Analytics';
    if (/action|execution|copy-link|save current|reset|cleanup/i.test(label)) return 'Controls';
    if (/geographic|mapping|projection|globe/i.test(label)) return 'Mapping';
    return 'Operations';
  }

  function persistLayers() {
    window.localStorage.setItem(storageKey, JSON.stringify(activeLayers));
  }

  function renderLayerState() {
    const countEl = document.getElementById('systems-online-count');
    const statusSystemsEl = document.getElementById('status-strip-systems');
    if (countEl) countEl.textContent = String(activeLayers.length);
    if (statusSystemsEl) {
  if (statusSystemsEl) statusSystemsEl.textContent = String(activeLayers.length);
      statusSystemsEl.dataset.tone = activeLayers.length > 0 ? 'online' : 'neutral';
    }

    if (activeLayerBox) {
  if (activeLayerBox) activeLayerBox.innerHTML = activeLayers.map((label) => `
        <button class="tag-chip active-layer-chip" data-active-layer="${label.replace(/"/g, '&quot;')}">
          <span>${label}</span>
          <span class="active-layer-remove">×</span>
        </button>
      `).join('') || '<div class="task-focus-meta">No active layers selected.</div>';
    }

    if (modalTags) {
      const grouped = layerOptions.reduce((acc, label) => {
        const category = categorizeLayer(label);
        if (!acc[category]) acc[category] = [];
        acc[category].push(label);
        return acc;
      }, {});
  if (modalTags) modalTags.innerHTML = categoryOrder
        .filter((category) => Array.isArray(grouped[category]) && grouped[category].length)
        .map((category) => `
          <section class="layer-category">
            <div class="panel-kicker">${category}</div>
            <div class="layer-option-grid">
              ${grouped[category].map((label) => `
                <button class="tag-chip layer-option ${activeLayers.includes(label) ? 'active' : ''}" data-layer-option="${label.replace(/"/g, '&quot;')}">${label}</button>
              `).join('')}
            </div>
          </section>
        `).join('');
    }
  }

  function openLayerModal() {
    modal.classList.add('visible');
  }

  function closeLayerModal() {
    modal.classList.remove('visible');
  }

  currentLayerCard.addEventListener('click', (event) => {
    if (event.target.closest('#systems-online-count')) {
      openLayerModal();
      return;
    }
    if (event.target.closest('#reset-layer-modal')) {
      activeLayers = [...defaultLayers];
      persistLayers();
      renderLayerState();
      return;
    }
    const chip = event.target.closest('[data-active-layer]');
    if (!chip) return;
    activeLayers = activeLayers.filter((label) => label !== chip.dataset.activeLayer);
    persistLayers();
    renderLayerState();
  });

  modal.addEventListener('click', (event) => {
    if (event.target === modal || event.target.closest('#close-layer-modal')) {
      closeLayerModal();
      return;
    }
    const option = event.target.closest('[data-layer-option]');
    if (!option) return;
    const label = option.dataset.layerOption;
    if (activeLayers.includes(label)) {
      activeLayers = activeLayers.filter((item) => item !== label);
    } else {
      activeLayers = [...activeLayers, label];
    }
    persistLayers();
    renderLayerState();
  });

  renderLayerState();
  currentLayerCard.dataset.layerConfigReady = '1';
}

function syncAirToggle() {
  const button = document.getElementById('toggle-air-layer');
  if (!button) return;
  button.classList.toggle('active', airLayerEnabled);
}

function syncSatelliteToggle() {
  const button = document.getElementById('toggle-satellite-layer');
  const filters = document.getElementById('sat-orbit-filters');
  if (!button) return;
  button.classList.toggle('active', satelliteLayerEnabled);
  if (filters) {
    filters.style.display = satelliteLayerEnabled ? 'flex' : 'none';
    ['LEO', 'MEO', 'GEO'].forEach(cls => {
      const btn = filters.querySelector(`[data-orbit="${cls}"]`);
      if (btn) {
        const on = visibleSatelliteOrbits.has(cls);
        btn.style.opacity = on ? '1' : '0.35';
        btn.style.textDecoration = on ? 'none' : 'line-through';
      }
    });
  }
}

async function refreshThreatFeed() {
  if (!threatLayerEnabled) {
    threatArcData = [];
    threatHotspots = [];
    return;
  }
  try {
    const data = await fetchJson('api/threat-feed.php');
    threatArcData = data.arcs || [];
    threatHotspots = data.hotspots || [];
  } catch {
    threatArcData = [];
    threatHotspots = [];
  }
}

function getThreatArcElements() {
  if (!threatLayerEnabled || threatArcData.length === 0) return [];
  // Convert threat arcs into globe format
  return threatArcData.map(arc => ({
    kind: 'threat',
    srcLat: arc.srcLat,
    srcLng: arc.srcLng,
    tgtLat: arc.tgtLat,
    tgtLng: arc.tgtLng,
    type: arc.type,
    intensity: arc.intensity,
    label: `<div style="text-align:center"><strong>${arc.type}</strong><br/>${arc.srcCountry} → ${arc.tgtName}</div>`,
    raw: arc
  }));
}

function getThreatHotspotPoints() {
  if (!threatLayerEnabled) return [];
  const points = [];
  // Pulsing rings for top hotspots
  threatHotspots.forEach(hs => {
    points.push({
      kind: 'threat',
      lat: hs.lat,
      lng: hs.lng,
      size: Math.min(1.2, 0.3 + (hs.count * 0.15)),
      color: '#ff3333',
      ringColor: '#ff3333',
      ringMaxRadius: 2 + hs.count * 0.5,
      ringPropagationSpeed: 2,
      ringRepeatPeriod: 800,
      label: `<div style="text-align:center;color:#ff3333"><strong>${hs.name}</strong><br/>${hs.count} threats</div>`,
      shortLabel: hs.name,
      raw: { kind: 'threat', type: 'Hotspot', country: hs.name, count: hs.count }
    });
  });
  // Small steady dots at every unique arc origin so arcs always start from a visible point
  const seen = new Set();
  threatArcData.forEach(arc => {
    const key = `${arc.srcLat},${arc.srcLng}`;
    if (seen.has(key)) return;
    seen.add(key);
    points.push({
      kind: 'threat',
      lat: arc.srcLat,
      lng: arc.srcLng,
      size: 0.35,
      color: '#ff6644',
      ringColor: '#ff6644',
      ringMaxRadius: 0,
      ringPropagationSpeed: 0,
      ringRepeatPeriod: 0,
      label: `<div style="text-align:center;color:#ff6644"><strong>${arc.srcCountry}</strong><br/>${arc.type}</div>`,
      shortLabel: arc.srcCountry,
      raw: { kind: 'threat', type: arc.type, country: arc.srcCountry, count: 1 }
    });
  });
  return points;
}

async function refreshAirTraffic() {
  if (!airLayerEnabled) {
    currentAirTrafficItems = [];
    return;
  }
  try {
    currentAirTrafficItems = ((await fetchJson('api/air-traffic.php')).items || []).filter(f => f.altitude > 0 && f.velocity > 25);
  } catch {
    currentAirTrafficItems = [];
  }
}

async function fetchFlightDetail(callsign) {
  const key = (callsign || '').trim().toUpperCase();
  if (!key) return null;
  if (flightDetailCache.has(key)) return flightDetailCache.get(key);
  try {
    const detail = await fetchJson(`api/flight-detail.php?callsign=${encodeURIComponent(key)}`);
    flightDetailCache.set(key, detail);
    return detail;
  } catch {
    return null;
  }
}

function getAircraftAltitudeRatio(altitudeMeters = 0) {
  return Math.max(0.004, Math.min(0.03, (altitudeMeters || 0) / 400000));
}

function projectPointFromBearing(lat, lng, bearingDeg, distanceKm) {
  const earthRadiusKm = 6371;
  const angularDistance = distanceKm / earthRadiusKm;
  const bearing = (bearingDeg || 0) * (Math.PI / 180);
  const lat1 = lat * (Math.PI / 180);
  const lng1 = lng * (Math.PI / 180);

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
    Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing)
  );
  const lng2 = lng1 + Math.atan2(
    Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
    Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2)
  );

  return {
    lat: lat2 * (180 / Math.PI),
    lng: ((lng2 * (180 / Math.PI) + 540) % 360) - 180
  };
}

function buildPlaneSvg(heading = 0, isSelected = false, isCommercial = true) {
  const fillColor = isCommercial ? (isSelected ? '#D2FF54' : 'rgba(255,255,255,0.97)') : (isSelected ? '#ff3c3c' : 'rgba(255,60,60,0.8)');
  const strokeColor = isCommercial ? 'rgba(210,255,84,0.82)' : 'rgba(255,60,60,0.82)';
  const shadowColor = isCommercial ? 'rgba(210,255,84,0.45)' : 'rgba(255,60,60,0.45)';
  return `
    <svg viewBox="0 0 24 24" width="18" height="18" style="display:block; transform: rotate(${heading}deg); transform-origin: 50% 50%; transform-box: fill-box; filter: drop-shadow(0 0 6px ${shadowColor});">
      <path d="M12 1.5 14.2 8.4 21 10.6 21 12.4 14.2 13.6 13.3 22.5 10.7 22.5 9.8 13.6 3 12.4 3 10.6 9.8 8.4Z" fill="${fillColor}" stroke="${strokeColor}" stroke-width="0.55" stroke-linejoin="round"/>
    </svg>
  `;
}


function getSatAlpha(sat) {
  const baseAlpha = 1;
  const dimmedAlpha = 0.5;
  const selectedAlpha = 1;

  if (selectedSatOrbit) {
    return sat.orbitClass === selectedSatOrbit ? selectedAlpha : dimmedAlpha;
  }

  if (selectedSatNetwork) {
    const net = sat.network || 'Unknown';
    return net === selectedSatNetwork ? selectedAlpha : dimmedAlpha;
  }

  return baseAlpha;
}

function getFlightAlpha(flight, isPath = false) {
  const baseAlpha = isPath ? 0.6 : 1;
  const selectedAlpha = isPath ? 0.8 : 1;
  const dimmedAlpha = isPath ? 0.2 : 0.5;

  if (selectedAirRegion && flight.country !== selectedAirRegion) {
    return 0;
  }

  if (selectedAirIcao24) {
    return flight.icao24 === selectedAirIcao24 ? selectedAlpha : dimmedAlpha;
  }

  if (selectedAirCategory) {
    const isCommercial = flight.callsign && /^[A-Z]{3}[A-Z0-9]{1,5}$/i.test(flight.callsign.trim());
    const matchesCat = selectedAirCategory === 'commercial' ? isCommercial : !isCommercial;
    return matchesCat ? baseAlpha : dimmedAlpha;
  }

  return baseAlpha;
}

function getAirTrafficGlobeElements() {
  if (!airLayerEnabled) return [];
  return currentAirTrafficItems.map((flight) => ({
    kind: 'air',
    lat: flight.lat,
    lng: flight.lng,
    altitude: getAircraftAltitudeRatio(flight.altitude || 0),
    heading: flight.heading || 0,
    opacity: getFlightAlpha(flight, false),
    label: `${flight.callsign || 'Unknown'} · ${flight.country || 'In flight'}`,
    raw: {
      ...flight,
      kind: 'air'
    }
  })).filter(f => f.opacity > 0);
}

function getAirTrafficPaths() {
  if (!airLayerEnabled) return [];
  return currentAirTrafficItems.map((flight) => {
    const distanceKm = Math.max(80, Math.min(260, ((flight.velocity || 220) * 900) / 1000));
    const forwardPoint = projectPointFromBearing(flight.lat, flight.lng, flight.heading || 0, distanceKm * 0.55);
    const trailingPoint = projectPointFromBearing(flight.lat, flight.lng, (flight.heading || 0) + 180, distanceKm * 0.45);
    const alpha = getFlightAlpha(flight, true);
    const altitude = getAircraftAltitudeRatio(flight.altitude || 0);
    return {
      color: `rgba(210,255,84,${alpha})`,
      points: [
        { lat: trailingPoint.lat, lng: trailingPoint.lng, alt: altitude },
        { lat: flight.lat, lng: flight.lng, alt: altitude },
        { lat: forwardPoint.lat, lng: forwardPoint.lng, alt: altitude }
      ]
    };
  });
}

async function refreshMaritimeCatalog(zoomToRegion = false) {
  if (!seaLayerEnabled) {
    currentVesselCatalog = [];
    return;
  }
  if (!seaRegion) {
    currentVesselCatalog = [];
    initOrUpdateGlobe(currentGlobeBaseItems || []);
    updateDataPanel();
    return;
  }
  try {
    currentVesselCatalog = (await fetchJson('api/maritime-tracker.php?region=' + seaRegion)).items || [];
    if (zoomToRegion && typeof intelGlobe !== 'undefined' && intelGlobe) {
        const targetLat = seaRegion === 'hormuz' ? 26.5 : 25.0;
        const targetLng = seaRegion === 'hormuz' ? 56.2 : -90.0;
        intelGlobe.pointOfView({ lat: targetLat, lng: targetLng, altitude: 1.5 }, 2000);
        setTimeout(() => {
            if (typeof showMapStage === 'function') {
                showMapStage({
                    kind: 'sea-region',
                    lat: targetLat,
                    lng: targetLng,
                    locationName: seaRegion === 'hormuz' ? 'Strait of Hormuz' : 'Gulf of Mexico'
                });
            }
        }, 2200);
    }
    initOrUpdateGlobe(currentGlobeBaseItems || []);
    updateDataPanel();
  } catch {
    currentVesselCatalog = [];
  }
}

function getSeaAlpha(vessel) {
  const baseAlpha = 1;
  const dimmedAlpha = 0.4;
  if (selectedSeaType) {
    return vessel.type === selectedSeaType ? 1 : dimmedAlpha;
  }
  if (selectedSeaFlag) {
    return vessel.flag === selectedSeaFlag ? 1 : dimmedAlpha;
  }
  return baseAlpha;
}

async function refreshSatelliteCatalog() {
  if (!satelliteLayerEnabled) {
    currentSatelliteCatalog = [];
    return;
  }
  try {
    currentSatelliteCatalog = (await fetchJson('api/satellite-tracker.php')).items || [];
  } catch {
    currentSatelliteCatalog = [];
  }
}

function getSatellitePreviewImage(satItem) {
  const title = String(satItem?.name || 'Tracked satellite').replace(/[&<>]/g, '');
  const subtitle = String(satItem?.network || satItem?.orbitClass || 'Orbital asset').replace(/[&<>]/g, '');
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#03131a"/>
          <stop offset="100%" stop-color="#071f2b"/>
        </linearGradient>
        <linearGradient id="panel" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#00e5ff" stop-opacity="0.95"/>
          <stop offset="100%" stop-color="#8ef7ff" stop-opacity="0.98"/>
        </linearGradient>
      </defs>
      <rect width="640" height="640" rx="32" fill="url(#bg)"/>
      <circle cx="480" cy="140" r="84" fill="#0f3340" opacity="0.58"/>
      <circle cx="480" cy="140" r="52" fill="#00e5ff" opacity="0.24"/>
      <g transform="translate(320 285)">
        <rect x="-46" y="-46" width="92" height="92" rx="12" fill="url(#panel)"/>
        <rect x="-190" y="-28" width="120" height="56" rx="8" fill="#0d5263" stroke="#8ef7ff" stroke-width="6"/>
        <rect x="70" y="-28" width="120" height="56" rx="8" fill="#0d5263" stroke="#8ef7ff" stroke-width="6"/>
        <path d="M0-120V-46M0 46v120M-70 0H-190M70 0H190" stroke="#dffcff" stroke-width="10" stroke-linecap="round"/>
      </g>
      <text x="48" y="548" fill="#e8ffff" font-size="34" font-family="Arial, sans-serif" font-weight="700">${title}</text>
      <text x="48" y="590" fill="#8ef7ff" font-size="22" font-family="Arial, sans-serif">${subtitle}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function setDrawerImage(imageUrl, altText = 'Preview image') {
  const thumb = document.getElementById('intel-drawer-thumb');
  const thumbImage = document.getElementById('intel-drawer-thumb-image');
  if (!thumb || !thumbImage) return;
  if (!imageUrl) {
    thumb.style.display = 'none';
    thumbImage.removeAttribute('src');
    thumbImage.alt = altText;
    return;
  }
  thumbImage.src = imageUrl;
  thumbImage.alt = altText;
  thumb.style.display = 'inline-flex';
}

function computeSatelliteLiveState(satItem, date = new Date()) {
  try {
    const satrec = window.satellite.twoline2satrec(satItem.tle1, satItem.tle2);
    const propagated = window.satellite.propagate(satrec, date);
    const position = propagated?.position;
    if (!position) return null;
    const gmst = window.satellite.gstime(date);
    const geodetic = window.satellite.eciToGeodetic(position, gmst);
    const lat = window.satellite.radiansToDegrees(geodetic.latitude);
    const lng = window.satellite.radiansToDegrees(geodetic.longitude);
    const altitudeKm = Math.max(0, geodetic.height || satItem.altitudeKm || 0);
    return {
      lat,
      lng,
      altitudeKm,
      altitudeRatio: Math.min(0.18, 0.04 + (altitudeKm / 30000) * 0.12)
    };
  } catch {
    return null;
  }
}

function satelliteOrbitColor(orbitClass, alpha) {
  if (orbitClass === 'LEO') return `rgba(0,229,100,${alpha})`;
  if (orbitClass === 'GEO') return `rgba(255,60,60,${alpha})`;
  return `rgba(0,229,255,${alpha})`;
}

function getSatelliteGlobeElements() {
  if (!satelliteLayerEnabled || !currentSatelliteCatalog.length || !window.satellite) return [];
  const now = new Date();
  return currentSatelliteCatalog.filter((satItem) => visibleSatelliteOrbits.has(satItem.orbitClass || 'LEO')).map((satItem) => {
    const live = computeSatelliteLiveState(satItem, now);
    if (!live) return null;
    return {
      kind: 'satellite',
      lat: live.lat,
      lng: live.lng,
      altitude: live.altitudeRatio,
      color: satelliteOrbitColor(satItem.orbitClass || 'LEO', 0.01),
      label: `${satItem.name} · ${satItem.network} · ${satItem.orbitClass || 'LEO'}`,
      raw: {
        ...satItem,
        lat: live.lat,
        lng: live.lng,
        liveAltitudeKm: Math.round(live.altitudeKm),
        kind: 'satellite'
      }
    };
  }).filter(Boolean);
}

function getSatelliteOrbitPaths() {
  if (!satelliteLayerEnabled || !currentSatelliteCatalog.length || !window.satellite) return [];
  const offsetsMinutes = [-30, -20, -10, 0, 10, 20, 30];
  return currentSatelliteCatalog.filter((satItem) => visibleSatelliteOrbits.has(satItem.orbitClass || 'LEO')).map((satItem) => {
    const points = offsetsMinutes.map((offsetMinutes) => {
      const state = computeSatelliteLiveState(satItem, new Date(Date.now() + (offsetMinutes * 60000)));
      if (!state) return null;
      return { lat: state.lat, lng: state.lng, alt: state.altitudeRatio };
    }).filter(Boolean);
    if (points.length < 2) return null;
    return {
      color: satelliteOrbitColor(satItem.orbitClass || 'LEO', 0.18),
      points
    };
  }).filter(Boolean);
}

function syncSatelliteLayerTimer() {
  if (satelliteLayerTimer) {
    clearInterval(satelliteLayerTimer);
    satelliteLayerTimer = null;
  }
  if (!satelliteLayerEnabled) return;
  satelliteLayerTimer = window.setInterval(() => {
    initOrUpdateGlobe(currentGlobeBaseItems || []);
  }, 15000);
}

function initializeCommandSurface() {
  setDiagnosticsVisible(false);

  const triageContainer = document.getElementById('intel-live-triage');
  if (triageContainer && !triageContainer.dataset.boundClicks) {
    triageContainer.addEventListener('click', (event) => {
      const catBtn = event.target.closest('[data-air-category]');
      if (catBtn) {
        const cat = catBtn.dataset.airCategory;
        if (cat === 'all') {
          selectedAirCategory = null;
        } else if (selectedAirCategory === cat) {
          selectedAirCategory = null;
        } else {
          selectedAirCategory = cat;
        }
        if (typeof initOrUpdateGlobe === "function") initOrUpdateGlobe(currentGlobeBaseItems || []);
        if (typeof updateDataPanel === "function") updateDataPanel();
        return;
      }

      const regionBtn = event.target.closest('[data-air-region]');
      if (regionBtn) {
        const region = regionBtn.dataset.airRegion;
        if (selectedAirRegion === region) {
          selectedAirRegion = null;
          if (typeof intelGlobe !== 'undefined' && intelGlobe) intelGlobe.pointOfView({ lat: 39.0, lng: -98.0, altitude: 1.7 }, 1800);
        } else {
          selectedAirRegion = region;
          const regionalFlights = currentAirTrafficItems.filter(f => f.country === region);
          if (typeof intelGlobe !== 'undefined' && intelGlobe && regionalFlights.length > 0) {
             const avgLat = regionalFlights.reduce((sum, f) => sum + f.lat, 0) / regionalFlights.length;
             const avgLng = regionalFlights.reduce((sum, f) => sum + f.lng, 0) / regionalFlights.length;
             intelGlobe.pointOfView({ lat: avgLat, lng: avgLng, altitude: 1.5 }, 1800);
          }
        }
        
        if (typeof initOrUpdateGlobe === "function") initOrUpdateGlobe(currentGlobeBaseItems || []);
        if (typeof updateDataPanel === "function") updateDataPanel();
      }
    });
    triageContainer.dataset.boundClicks = '1';
  }

  initializeLayerConfigurator();
  syncAirToggle();
  syncSatelliteToggle();

  const toggleButton = document.getElementById('toggle-diagnostics');
  if (toggleButton && !toggleButton.dataset.bound) {
    toggleButton.addEventListener('click', () => setDiagnosticsVisible(!diagnosticsVisible));
    toggleButton.dataset.bound = '1';
  }
  
  const closeModalBtn = document.getElementById('close-diagnostics-modal');
  if (closeModalBtn && !closeModalBtn.dataset.bound) {
    closeModalBtn.addEventListener('click', () => setDiagnosticsVisible(false));
    closeModalBtn.dataset.bound = '1';
  }

  const closeButton = document.getElementById('intel-drawer-close');
  if (closeButton && !closeButton.dataset.bound) {
    closeButton.addEventListener('click', closeIntelDrawer);
    closeButton.dataset.bound = '1';
  }

  const drawerThumb = document.getElementById('intel-drawer-thumb');
  const drawerThumbImage = document.getElementById('intel-drawer-thumb-image');
  const lightbox = document.getElementById('intel-image-lightbox');
  const lightboxImage = document.getElementById('intel-image-lightbox-image');
  const lightboxClose = document.getElementById('intel-image-lightbox-close');
  if (drawerThumb && drawerThumbImage && lightbox && lightboxImage && !drawerThumb.dataset.bound) {
    drawerThumb.addEventListener('click', () => {
      if (!drawerThumbImage.src) return;
      lightboxImage.src = drawerThumbImage.src;
      lightboxImage.alt = drawerThumbImage.alt || 'Expanded preview';
      lightbox.style.display = 'flex';
      lightbox.setAttribute('aria-hidden', 'false');
    });
    drawerThumb.dataset.bound = '1';
  }
  if (lightbox && !lightbox.dataset.bound) {
    lightbox.addEventListener('click', (event) => {
      if (event.target === lightbox || event.target === lightboxClose) {
        lightbox.style.display = 'none';
        lightbox.setAttribute('aria-hidden', 'true');
      }
    });
    lightbox.dataset.bound = '1';
  }

  const airButton = document.getElementById('toggle-air-layer');
  if (airButton && !airButton.dataset.bound) {
    airButton.addEventListener('click', async () => {
      airLayerEnabled = !airLayerEnabled;
      if (!airLayerEnabled) selectedAirIcao24 = null;
      syncAirToggle();
      await refreshAirTraffic();
      initOrUpdateGlobe(currentGlobeBaseItems || []);
    });
    airButton.dataset.bound = '1';
  }

  const satelliteButton = document.getElementById('toggle-satellite-layer');
  if (satelliteButton && !satelliteButton.dataset.bound) {
    satelliteButton.addEventListener('click', async () => {
      satelliteLayerEnabled = !satelliteLayerEnabled;
      syncSatelliteToggle();
      if (satelliteLayerEnabled) {
        await ensureSatelliteLib();
        await refreshSatelliteCatalog();
        syncSatelliteLayerTimer();
        airLayerEnabled = false;
        syncAirToggle();
        seaLayerEnabled = false;
        const bSea = document.getElementById('toggle-sea-layer');
        if (bSea) { bSea.classList.remove('active'); }
        currentVesselCatalog = [];
        if (seaLayerTimer) clearInterval(seaLayerTimer);
      }
      initOrUpdateGlobe(currentGlobeBaseItems || []);
      updateDataPanel();
    });
    satelliteButton.dataset.bound = '1';
  }

  const seaButton = document.getElementById('toggle-sea-layer');
  if (seaButton && !seaButton.dataset.bound) {
      seaButton.addEventListener('click', async () => {
          seaLayerEnabled = !seaLayerEnabled;
          seaButton.classList.toggle('active', seaLayerEnabled);
          
          if (seaLayerEnabled) {
              airLayerEnabled = false;
              syncAirToggle();
              satelliteLayerEnabled = false;
              syncSatelliteToggle();
              if (satelliteLayerTimer) { clearInterval(satelliteLayerTimer); satelliteLayerTimer = null; }
              
              seaRegion = null;
              selectedSeaType = null;
              selectedSeaFlag = null;
              
              await refreshMaritimeCatalog(false);
              if (!seaLayerTimer) {
                  seaLayerTimer = setInterval(() => refreshMaritimeCatalog(false), 15000);
              }
          } else {
              if (seaLayerTimer) { clearInterval(seaLayerTimer); seaLayerTimer = null; }
              currentVesselCatalog = [];
              seaRegion = null;
          }
          
          initOrUpdateGlobe(currentGlobeBaseItems || []);
          updateDataPanel();
      });
      seaButton.dataset.bound = '1';
  }

  const threatButton = document.getElementById('toggle-threat-layer');
  if (threatButton && !threatButton.dataset.bound) {
    threatButton.addEventListener('click', async () => {
      threatLayerEnabled = !threatLayerEnabled;
      threatButton.classList.toggle('active', threatLayerEnabled);
      if (threatLayerEnabled && threatArcData.length === 0) {
        await refreshThreatFeed();
      }
      initOrUpdateGlobe(currentGlobeBaseItems || []);
    });
    threatButton.dataset.bound = '1';
  }

  document.querySelectorAll('[data-orbit]').forEach(btn => {
    if (btn.dataset.bound) return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', () => {
      const cls = btn.dataset.orbit;
      if (visibleSatelliteOrbits.has(cls)) visibleSatelliteOrbits.delete(cls);
      else visibleSatelliteOrbits.add(cls);
      syncSatelliteToggle();
      initOrUpdateGlobe(currentGlobeBaseItems || []);
    });
  });

  const returnButton = document.getElementById('return-to-globe');
  if (returnButton && !returnButton.dataset.bound) {
    returnButton.addEventListener('click', showGlobeStage);
    returnButton.dataset.bound = '1';
  const ontologyBtn = document.getElementById('toggle-ontology-graph');
  if (ontologyBtn && !ontologyBtn.dataset.bound) {
    ontologyBtn.addEventListener('click', showGraphStage);
    ontologyBtn.dataset.bound = '1';
  }
  }

  const zoneButton = document.getElementById('toggle-pittsburgh-zones');
  if (zoneButton && !zoneButton.dataset.bound) {
    zoneButton.addEventListener('click', togglePittsburghZones);
    zoneButton.dataset.bound = '1';
  }

  const dangerBtn = document.getElementById('toggle-danger-zones');
  if (dangerBtn && !dangerBtn.dataset.bound) {
    dangerBtn.addEventListener('click', toggleDangerZones);
    dangerBtn.dataset.bound = '1';
  }

  // Map/Satellite toggle
  const mapStyleBtn = document.getElementById('toggle-map-style');
  if (mapStyleBtn && !mapStyleBtn.dataset.bound) {
    mapStyleBtn.addEventListener('click', () => {
      const isSatellite = mapStyleBtn.textContent.trim() === 'Satellite';
      mapStyleBtn.textContent = isSatellite ? 'Map' : 'Satellite';
      // Toggle globe.gl imagery
      if (typeof intelGlobe !== 'undefined' && intelGlobe && intelGlobe.globeImageUrl) {
        if (isSatellite) {
          // Switch to map
          intelGlobe.globeImageUrl('//unpkg.com/three-globe/example/img/earth-topology.png');
        } else {
          // Switch back to satellite
          intelGlobe.globeImageUrl('//unpkg.com/three-globe/example/img/earth-blue-marble.jpg');
        }
      }
      // Toggle Leaflet city map tiles
      if (cityMapInstance && cityMapInstance._satelliteTile && cityMapInstance._labelTile) {
        if (isSatellite) {
          cityMapInstance.removeLayer(cityMapInstance._satelliteTile);
          cityMapInstance._osmTile = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(cityMapInstance);
          if (cityMapInstance._labelTile) cityMapInstance.removeLayer(cityMapInstance._labelTile);
          cityMapInstance._labelTile = null;
        } else {
          if (cityMapInstance._osmTile) cityMapInstance.removeLayer(cityMapInstance._osmTile);
          cityMapInstance._osmTile = null;
          cityMapInstance._satelliteTile = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }).addTo(cityMapInstance);
          cityMapInstance._labelTile = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png', { maxZoom: 19, opacity: 0.8, subdomains: 'abcd' }).addTo(cityMapInstance);
        }
      }
    });
    mapStyleBtn.dataset.bound = '1';
  }

  // Detail panel close button
  const detailCloseBtn = document.getElementById('detail-panel-close');
  if (detailCloseBtn && !detailCloseBtn.dataset.bound) {
    detailCloseBtn.addEventListener('click', closeDetailPanel);
    detailCloseBtn.dataset.bound = '1';
  }

  if (baselineRecommendationActions && !baselineRecommendationActions.dataset.drawerBound) {
    baselineRecommendationActions.addEventListener('click', (event) => {
      const chip = event.target.closest('[data-baseline-recommendation]');
      if (!chip) return;
      const item = currentPriorityItems.find((entry) => entry.action === chip.dataset.baselineRecommendation);
      if (item) openIntelDrawer(item);
    });
    baselineRecommendationActions.dataset.drawerBound = '1';
  }
}


function getEventClientPoint(event) {
  if (typeof event?.clientX === 'number' && typeof event?.clientY === 'number') {
    return { clientX: event.clientX, clientY: event.clientY };
  }
  const touch = event?.touches?.[0] || event?.changedTouches?.[0];
  if (touch && typeof touch.clientX === 'number' && typeof touch.clientY === 'number') {
    return { clientX: touch.clientX, clientY: touch.clientY };
  }
  return null;
}

function isInsideGlobeHitArea(event, container) {
  const point = getEventClientPoint(event);
  if (!container || !point) return false;
  const rect = container.getBoundingClientRect();
  const centerX = rect.left + (rect.width / 2);
  const centerY = rect.top + (rect.height / 2);
  const radius = Math.min(rect.width, rect.height) * 0.38;
  const dx = point.clientX - centerX;
  const dy = point.clientY - centerY;
  return (dx * dx) + (dy * dy) <= radius * radius;
}

function hasCoarsePointer() {
  return (typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches) || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0);
}

function getInteractionMode() {
  return hasCoarsePointer() ? 'mobile' : 'desktop';
}

function applyInteractionMode() {
  document.body?.setAttribute('data-interaction-mode', getInteractionMode());
}

function syncGlobeControls(container, enabled) {
  if (!intelGlobe?.controls || !container) return;
  const controls = intelGlobe.controls();
  const allowControls = hasCoarsePointer() ? true : enabled;
  controls.enableZoom = allowControls;
  controls.enableRotate = allowControls;
  if (!allowControls) container.style.cursor = 'default';
}

function updateGlobeTexture() {
  if (!intelGlobe) return;
  const nightUrl = '//unpkg.com/three-globe/example/img/earth-night.jpg';
  const dayUrl = '//unpkg.com/three-globe/example/img/earth-blue-marble.jpg';
  intelGlobe.globeImageUrl(isNightTime() ? nightUrl : dayUrl);
}

// Swap globe texture on the hour to match day/night
setInterval(updateGlobeTexture, 60 * 60 * 1000);

function setGlobeOverlayVisibility(visible) {
  const threatButton = document.getElementById('toggle-threat-layer');
  const title = document.getElementById('globe-floating-title');
  if (title) title.style.opacity = visible ? '1' : '0';
}

function updateGlobeLabelVisibility() {
  if (!intelGlobe?.labelsData) return;
  intelGlobe.labelsData([]);
}

function buildMapEmbedUrl(lat, lng) {
  const delta = 0.18;
  const minLat = lat - delta;
  const maxLat = lat + delta;
  const minLng = lng - delta;
  const maxLng = lng + delta;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${minLng}%2C${minLat}%2C${maxLng}%2C${maxLat}&layer=mapnik&marker=${lat}%2C${lng}`;
}

function destroyCityMap() {
  closeDetailPanel();
  if (pittsburghZoneLayer && cityMapInstance) {
    cityMapInstance.removeLayer(pittsburghZoneLayer);
  }
  pittsburghZoneLayer = null;
  if (cityMapInstance?.remove) {
    cityMapInstance.remove();
  }
  cityMapInstance = null;
  mapHoverCard = null;
  if (mapHoverHideTimer) {
    clearTimeout(mapHoverHideTimer);
    mapHoverHideTimer = null;
  }
}

function zoneFillColor(zone) {
  const shades = {
    '1': '#d9d9d9',
    '2': '#c8c8c8',
    '3': '#b8b8b8',
    '4': '#a8a8a8',
    '5': '#989898',
    '6': '#888888'
  };
  return shades[String(zone)] || '#b0b0b0';
}

function getZoneStyle(zone, visible = true) {
  return {
    color: 'rgba(220,220,220,0)',
    weight: 0,
    opacity: 0,
    fillColor: zoneFillColor(zone),
    fillOpacity: visible ? 0.5 : 0,
    dashArray: null
  };
}

function getPittsburghZoneStats(zone) {
  const zoneEntry = pittsburghZoneStatsData?.zones?.[String(zone)];
  if (!zoneEntry) return {};
  return zoneEntry?.all || {};
}

function syncPittsburghYearControl(eligible = false) {
  // Year selector removed — all data in single month dropdown
}

function getAvailableMonths(crimes) {
  const months = new Set();
  crimes.forEach((c) => {
    const t = c.time || '';
    const m = t.substring(0, 7);
    if (m && m.length === 7) months.add(m);
  });
  return [...months].sort();
}

function filterCrimesByMonth(crimes, monthKey) {
  let filtered = crimes;
  if (monthKey && monthKey !== 'all') filtered = filtered.filter((c) => (c.time || '').startsWith(monthKey));
  return filtered.filter((c) => pittsburghVisibleCategories.has(c.category));
}

let detailPanelOpen = false;

function openDetailPanel(html) {
  const panel = document.getElementById('detail-panel');
  const content = document.getElementById('detail-panel-content');
  if (!panel || !content) return;
  content.innerHTML = html;
  panel.classList.add('open');
  detailPanelOpen = true;
}

function closeDetailPanel() {
  const panel = document.getElementById('detail-panel');
  if (!panel) return;
  panel.classList.remove('open');
  detailPanelOpen = false;
}

function renderCrimeMarkers(crimes) {
  if (pittsburghCrimesLayer) {
    cityMapInstance.removeLayer(pittsburghCrimesLayer);
  }
  pittsburghCrimesLayer = L.layerGroup();
  crimes.forEach((crime) => {
    let color = '#757575'; // Other
    if (crime.category === 'Violent') color = '#d32f2f';
    else if (crime.category === 'Property') color = '#1976d2';
    else if (crime.category === 'Drug') color = '#388e3c';

    const marker = L.circleMarker([crime.lat, crime.lng], {
      radius: 4,
      stroke: true,
      color: '#fff',
      weight: 2,
      fillOpacity: 0.9,
      fillColor: color
    });
    const popupHtml = `
      <div class="crime-popup">
        <div class="crime-popup-header">
          <div class="crime-popup-dot" style="background:${color};"></div>
          <div class="crime-popup-cat">${crime.category} Crime</div>
        </div>
        <div class="crime-popup-body">
          <div class="crime-popup-title">${crime.incident_type}</div>
          <div class="crime-popup-row"><span>Zone</span><strong>${crime.zone}</strong></div>
          <div class="crime-popup-row"><span>Time</span><strong>${crime.time}</strong></div>
        </div>
        <div class="crime-popup-footer">Pittsburgh Bureau of Police</div>
      </div>
    `;
    const isNarrow = window.innerWidth < 700;
    if (isNarrow) {
      marker.bindPopup(popupHtml, { className: '', maxWidth: 300, closeButton: true });
    }
    marker.on('click', (event) => {
      if (event.originalEvent && typeof L !== 'undefined') {
        L.DomEvent.stop(event.originalEvent);
      }
      if (isNarrow) {
        marker.openPopup();
      } else {
        openDetailPanel(popupHtml);
      }
    });
    pittsburghCrimesLayer.addLayer(marker);
  });
  pittsburghCrimesLayer.addTo(cityMapInstance);

  // Sync marker visibility with toggle state
  if (!pittsburghMarkersVisible) {
    cityMapInstance.removeLayer(pittsburghCrimesLayer);
  }
}

function renderCrimeHeatmap(crimes) {
  if (pittsburghHeatLayer) {
    cityMapInstance.removeLayer(pittsburghHeatLayer);
  }
  if (typeof L.heatLayer === 'undefined') return;
  const points = crimes.map(c => [c.lat, c.lng, categoryIntensity(c.category)]);
  pittsburghHeatLayer = L.heatLayer(points, {
    radius: 30,
    blur: 24,
    maxZoom: 16,
    minOpacity: 0.2,
    gradient: {
      0.1: 'rgba(52,168,83,0.3)',
      0.3: 'rgba(251,188,4,0.5)',
      0.5: 'rgba(255,167,38,0.65)',
      0.7: 'rgba(234,67,53,0.78)',
      1.0: 'rgba(154,0,0,0.9)'
    }
  });
  pittsburghHeatLayer.addTo(cityMapInstance);

  if (!pittsburghHeatVisible) {
    cityMapInstance.removeLayer(pittsburghHeatLayer);
  }
}

function categoryIntensity(cat) {
  if (cat === 'Violent') return 0.9;
  if (cat === 'Property') return 0.6;
  if (cat === 'Drug') return 0.45;
  return 0.25;
}

function toggleCrimeHeatmap() {
  if (!cityMapInstance) return;
  pittsburghHeatVisible = !pittsburghHeatVisible;
  if (pittsburghHeatVisible && pittsburghHeatLayer) {
    pittsburghHeatLayer.addTo(cityMapInstance);
  } else if (pittsburghHeatLayer) {
    cityMapInstance.removeLayer(pittsburghHeatLayer);
  }
  const btn = document.getElementById('toggle-heatmap');
  if (btn) btn.classList.toggle('active', pittsburghHeatVisible);
}

function toggleCrimeMarkers() {
  if (!cityMapInstance) return;
  pittsburghMarkersVisible = !pittsburghMarkersVisible;
  if (pittsburghMarkersVisible && pittsburghCrimesLayer) {
    pittsburghCrimesLayer.addTo(cityMapInstance);
  } else if (pittsburghCrimesLayer) {
    cityMapInstance.removeLayer(pittsburghCrimesLayer);
  }
  const btn = document.getElementById('toggle-markers');
  if (btn) btn.classList.toggle('active', pittsburghMarkersVisible);
}

function renderDangerZones(predictions) {
  if (pittsburghDangerLayer) {
    cityMapInstance.removeLayer(pittsburghDangerLayer);
  }
  pittsburghDangerLayer = L.layerGroup();
  predictions.forEach((pred) => {
    const radius = pred.threatLevel === 'high' ? 22 : pred.threatLevel === 'medium' ? 16 : 10;
    const fillColor = pred.threatLevel === 'high' ? '#ff1744' : pred.threatLevel === 'medium' ? '#ff9100' : '#ffea00';
    const fillOpacity = pred.threatLevel === 'high' ? 0.35 : pred.threatLevel === 'medium' ? 0.25 : 0.18;
    const badgeColor = pred.threatLevel === 'high' ? 'background:#d32f2f;' : pred.threatLevel === 'medium' ? 'background:#e65100;' : 'background:#f9a825;color:#333;';

    const marker = L.circleMarker([pred.lat, pred.lng], {
      radius,
      stroke: true,
      color: fillColor,
      weight: pred.threatLevel === 'high' ? 2 : 1,
      fillOpacity,
      fillColor,
      className: pred.threatLevel === 'high' ? 'danger-pulse' : ''
    });
    const popupHtml = `
      <div class="danger-popup">
        <div class="danger-popup-header">
          <div class="danger-popup-badge" style="${badgeColor}">${pred.threatLevel} risk</div>
        </div>
        <div class="danger-popup-body">
          <div class="danger-popup-title">Predicted Danger Zone</div>
          <div class="danger-popup-row"><span>Danger Score</span><strong>${pred.dangerScore}/100</strong></div>
          <div class="danger-popup-row"><span>Active incidents</span><strong>${pred.incidentsNow} (${pred.violentNow} violent)</strong></div>
          <div class="danger-popup-row"><span>Today's total</span><strong>${pred.incidentsToday}</strong></div>
          <div class="danger-popup-row"><span>Peak hour</span><strong>${String(pred.peakHour).padStart(2, '0')}:00</strong></div>
          <div class="danger-popup-row"><span>Top category</span><strong>${pred.topCategory}</strong></div>
        </div>
        <div class="danger-popup-footer">Based on ${pred.dow} historical patterns ±2hrs</div>
      </div>
    `;
    const isNarrow = window.innerWidth < 700;
    if (isNarrow) {
      marker.bindPopup(popupHtml, { className: '', maxWidth: 320, closeButton: true });
    }
    marker.on('click', (event) => {
      if (event.originalEvent && typeof L !== 'undefined') {
        L.DomEvent.stop(event.originalEvent);
      }
      if (isNarrow) {
        marker.openPopup();
      } else {
        openDetailPanel(popupHtml);
      }
    });
    pittsburghDangerLayer.addLayer(marker);
  });
  pittsburghDangerLayer.addTo(cityMapInstance);
}

function toggleDangerZones() {
  if (!cityMapInstance) return;
  if (pittsburghDangerVisible) {
    if (pittsburghDangerLayer) cityMapInstance.removeLayer(pittsburghDangerLayer);
    pittsburghDangerVisible = false;
    const btn = document.getElementById('toggle-danger-zones');
    if (btn) btn.classList.remove('active');
    return;
  }
  fetchJson('api/crime-predict.php')
    .then((data) => {
      if (!data?.predictions?.length) return;
      renderDangerZones(data.predictions);
      pittsburghDangerVisible = true;
      const btn = document.getElementById('toggle-danger-zones');
      if (btn) btn.classList.add('active');
    })
    .catch(console.error);
}


function syncPittsburghMonthControl(eligible = false) {
  const monthSelect = document.getElementById('pittsburgh-month-select');
  const chipBar = document.getElementById('crime-chip-bar');
  if (!monthSelect) return;
  if (!eligible || !pittsburghCrimesData.length) {
    monthSelect.style.display = 'none';
    if (chipBar) chipBar.style.display = 'none';
    return;
  }
  const months = getAvailableMonths(pittsburghCrimesData);
  if (!months.length) {
    monthSelect.style.display = 'none';
    if (chipBar) chipBar.style.display = 'none';
    return;
  }

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  if (!pittsburghSelectedMonth) {
    pittsburghSelectedMonth = months.includes(currentMonth) ? currentMonth : (months.length ? months[months.length - 1] : 'all');
  }
  const monthNames = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  let optionsHtml = `<option value="all">All Months</option>`;
  months.forEach((m) => {
    const [y, mm] = m.split('-');
    const label = `${monthNames[parseInt(mm) - 1]} ${y}`;
    optionsHtml += `<option value="${m}">${label}</option>`;
  });
  if (monthSelect) monthSelect.innerHTML = optionsHtml;
  monthSelect.value = pittsburghSelectedMonth;
  monthSelect.style.display = 'inline-flex';

  // Show chip bar
  if (chipBar) {
    chipBar.style.display = 'flex';
    const mapStage = document.getElementById('intel-map-stage');
    if (mapStage && !mapStage.contains(chipBar)) {
      mapStage.appendChild(chipBar);
    }

    // Sync chip active states
    chipBar.querySelectorAll('.crime-chip[data-category]').forEach((chip) => {
      const cat = chip.dataset.category;
      chip.classList.toggle('active', pittsburghVisibleCategories.has(cat));
      // remove old listeners
      chip.replaceWith(chip.cloneNode(true));
    });
    chipBar.querySelectorAll('.crime-chip[data-category]').forEach((chip) => {
      chip.addEventListener('click', () => {
        const cat = chip.dataset.category;
        if (pittsburghVisibleCategories.has(cat)) {
          pittsburghVisibleCategories.delete(cat);
          chip.classList.remove('active');
        } else {
          pittsburghVisibleCategories.add(cat);
          chip.classList.add('active');
        }
        const filtered = filterCrimesByMonth(pittsburghCrimesData, pittsburghSelectedMonth);
        renderCrimeMarkers(filtered);
        renderCrimeHeatmap(filtered);
      });
    });

    // Heatmap toggle
    const heatBtn = document.getElementById('toggle-heatmap');
    const markBtn = document.getElementById('toggle-markers');
    if (heatBtn) {
      heatBtn.classList.toggle('active', pittsburghHeatVisible);
      heatBtn.onclick = () => toggleCrimeHeatmap();
    }
    if (markBtn) {
      markBtn.classList.toggle('active', pittsburghMarkersVisible);
      markBtn.onclick = () => toggleCrimeMarkers();
    }
  }

  const filtered = filterCrimesByMonth(pittsburghCrimesData, pittsburghSelectedMonth);
  renderCrimeMarkers(filtered);
  renderCrimeHeatmap(filtered);
}

function bindMonthSelect() {
  const monthSelect = document.getElementById('pittsburgh-month-select');
  if (monthSelect && !monthSelect.dataset.bound) {
    monthSelect.addEventListener('change', () => {
      pittsburghSelectedMonth = monthSelect.value;
      const filtered = filterCrimesByMonth(pittsburghCrimesData, pittsburghSelectedMonth);
      renderCrimeMarkers(filtered);
      renderCrimeHeatmap(filtered);
    });
    monthSelect.dataset.bound = '1';
  }
}

function buildMapStagePointFromClient(clientX, clientY) {
  const stage = document.getElementById('intel-map-stage');
  const rect = stage?.getBoundingClientRect();
  if (!rect) return null;
  return {
    x: clientX - rect.left,
    y: clientY - rect.top
  };
}

function updatePittsburghZoneLabelInteractivity() {
  if (!pittsburghZoneLayer) return;
  pittsburghZoneLayer.eachLayer((layer) => {
    const zone = String(layer.feature?.properties?.zone || layer.feature?.properties?.Zone_T || '');
    const tooltipEl = layer.getTooltip?.()?.getElement?.();
    if (!tooltipEl) return;
    if (!tooltipEl.dataset.bound) {
      const showZoneLabelCard = (event) => {
        if (pittsburghZonesVisible) return;
        const point = buildMapStagePointFromClient(event.clientX, event.clientY);
        setMapHoverCard(buildZonePopupHtml(zone, getPittsburghZoneStats(zone)), true, point);
      };
      tooltipEl.addEventListener('mouseenter', showZoneLabelCard);
      tooltipEl.addEventListener('mousemove', showZoneLabelCard);
      tooltipEl.addEventListener('mouseleave', () => {
        if (!pittsburghZonesVisible) setMapHoverCard('', false);
      });
      tooltipEl.addEventListener('click', (event) => {
        event.stopPropagation();
        showZoneLabelCard(event);
      });
      tooltipEl.dataset.bound = '1';
    }
    tooltipEl.style.pointerEvents = pittsburghZonesVisible ? 'none' : 'auto';
  });
}

function buildZonePopupHtml(zone, stats = {}) {
  const offenseRows = (stats.topOffenseTypes || []).slice(0, 5).map(([name, total]) => `
    <div class="zone-popup-row"><span>${name}</span><strong>${total}</strong></div>
  `).join('') || '<div style="font-size:12px;color:#5f6368;margin-top:6px;">No offense data available.</div>';

  return `
    <div class="zone-popup">
      <div class="zone-popup-header">
        <div class="zone-popup-title">Zone ${zone}</div>
        <div class="zone-popup-sub">Pittsburgh Bureau of Police</div>
      </div>
      <div class="zone-popup-body">
        <div class="zone-popup-stat">${(stats.incidentCount || 0).toLocaleString()}</div>
        <div class="zone-popup-stat-label">Total incidents</div>
        <div class="zone-popup-divider"></div>
        ${offenseRows}
      </div>
    </div>
  `;
}

async function renderPittsburghZoneOverlay() {
  if (!cityMapInstance || typeof L === 'undefined') return;
  if (!pittsburghZoneGeojsonData || !pittsburghZoneStatsData) {
    const [geojson, stats] = await Promise.all([
      fetchJson('data/pittsburgh/police_zones.geojson'),
      fetchJson('data/pittsburgh/zone_crime_stats.json')
    ]);
    pittsburghZoneGeojsonData = geojson;
    pittsburghZoneStatsData = stats;
  }

  syncPittsburghYearControl(true);

  if (pittsburghZoneLayer) {
    cityMapInstance.removeLayer(pittsburghZoneLayer);
    pittsburghZoneLayer = null;
  }

  pittsburghZoneLayer = L.geoJSON(pittsburghZoneGeojsonData, {
    interactive: false,
    style: (feature) => {
      const zone = String(feature?.properties?.zone || feature?.properties?.Zone_T || '');
      return getZoneStyle(zone, pittsburghZonesVisible);
    },
    onEachFeature: (feature, layer) => {
      const zone = String(feature?.properties?.zone || feature?.properties?.Zone_T || '');
      layer.bindTooltip(`Zone ${zone}`, {
        permanent: true,
        direction: 'center',
        className: 'pittsburgh-zone-label'
      });
    }
  });

  pittsburghZoneLayer.addTo(cityMapInstance);
  pittsburghZoneLayer.bringToBack();
  updatePittsburghZoneLabelInteractivity();
}

function syncPittsburghZoneToggle(visible, eligible = false) {
  pittsburghZonesVisible = visible;
  const button = document.getElementById('toggle-pittsburgh-zones');
  if (button) {
    button.style.display = eligible ? 'inline-flex' : 'none';
    if (button) button.textContent = visible ? 'Zones' : 'Zones';
  }
  const dangerBtn = document.getElementById('toggle-danger-zones');
  if (dangerBtn) dangerBtn.style.display = eligible ? 'inline-flex' : 'none';
  const mapStyleBtn = document.getElementById('toggle-map-style');
  // map-style toggle is always visible (works on both globe and city map)
  syncPittsburghYearControl(eligible);
  if (!eligible) {
    const ms = document.getElementById('pittsburgh-month-select');
    const cb = document.getElementById('crime-chip-bar');
    if (ms) ms.style.display = 'none';
    if (cb) cb.style.display = 'none';
  }
  updatePittsburghZoneLabelInteractivity();
}

function togglePittsburghZones() {
  if (!cityMapInstance || !pittsburghZoneLayer) return;
  pittsburghZonesVisible = !pittsburghZonesVisible;
  pittsburghZoneLayer.eachLayer((layer) => {
    const zone = String(layer.feature?.properties?.zone || layer.feature?.properties?.Zone_T || '');
    layer.setStyle(getZoneStyle(zone, pittsburghZonesVisible));
  });
  syncPittsburghZoneToggle(pittsburghZonesVisible, true);
}

function setMapHoverCard(content = '', visible = false, point = null) {
  if (mapHoverHideTimer) {
    clearTimeout(mapHoverHideTimer);
    mapHoverHideTimer = null;
  }
  if (!mapHoverCard) return;
  mapHoverCard.innerHTML = content;
  mapHoverCard.style.display = visible ? 'block' : 'none';
  if (!visible || !point) return;
  const mapRect = mapHoverCard.parentElement?.getBoundingClientRect();
  const cardRect = mapHoverCard.getBoundingClientRect();
  if (!mapRect) return;
  const cardWidth = cardRect.width || 260;
  const cardHeight = cardRect.height || 120;
  const offset = 16;
  const left = Math.min(
    Math.max(offset, point.x + offset),
    Math.max(offset, mapRect.width - cardWidth - offset)
  );
  const top = Math.min(
    Math.max(offset, point.y - cardHeight - offset),
    Math.max(offset, mapRect.height - cardHeight - offset)
  );
  mapHoverCard.style.left = `${left}px`;
  mapHoverCard.style.top = `${top}px`;
  mapHoverCard.style.right = 'auto';
}

function scheduleHideMapHoverCard() {
  if (mapHoverHideTimer) clearTimeout(mapHoverHideTimer);
  mapHoverHideTimer = setTimeout(() => {
    if (!mapHoverCard) return;
    mapHoverCard.style.display = 'none';
    mapHoverHideTimer = null;
  }, 120);
}

function renderCityCrimeMap(item = {}) {
  applyInteractionMode();
  const mapStage = document.getElementById('intel-map-stage');
  if (!mapStage || typeof item.lat !== 'number' || typeof item.lng !== 'number') return;

  const isSeaRegion = item.kind === 'sea-region';
  const crimeScan = isSeaRegion ? {
    center: [item.lat, item.lng],
    zoom: 6,
    points: []
  } : (cityCrimeScans[item.locationName] || {
    center: [item.lat, item.lng],
    zoom: 12,
    incidents: 0,
    hotspots: 0,
    points: [{ lat: item.lat, lng: item.lng, intensity: 0.35, zone: item.locationName || 'Unknown zone', totals: { activity: 0 } }]
  });

  if (typeof L === 'undefined') {
  if (mapStage) mapStage.innerHTML = `<iframe title="${item.locationName || item.action || 'Location'} map view" src="${buildMapEmbedUrl(item.lat, item.lng)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`;
    return crimeScan;
  }
  if (mapStage) mapStage.innerHTML = '<div id="intel-map-canvas"></div><div id="map-hover-card" class="map-hover-card" style="display:none;"></div>';
  destroyCityMap();
  mapHoverCard = document.getElementById('map-hover-card');
  mapStage.onmouseleave = () => setMapHoverCard('', false);

  cityMapInstance = L.map('intel-map-canvas', {
    zoomControl: false,
    attributionControl: false,
    scrollWheelZoom: true,
    touchZoom: true,
    tap: true
  }).setView(crimeScan.center, crimeScan.zoom);

  cityMapInstance.on('click', () => {
    setMapHoverCard('', false);
  });

  // Satellite-first tile layer (Google-style)
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
    subdomains: []
  }).addTo(cityMapInstance);

  // Optional labels overlay for road/city names (dark pills on satellite)
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    opacity: 0.8,
    subdomains: 'abcd'
  }).addTo(cityMapInstance);

  if (isSeaRegion && typeof currentVesselCatalog !== 'undefined') {
      currentVesselCatalog.forEach(v => {
          const isTanker = v.type === 'Tanker' || v.type === 'LNG Carrier';
          const dotColor = isTanker ? '#FFA500' : '#0096ff';
          const marker = L.circleMarker([v.lat, v.lng], {
              radius: 6,
              fillColor: dotColor,
              color: '#fff',
              weight: 1,
              opacity: 0.8,
              fillOpacity: 0.8
          }).addTo(cityMapInstance);
          
          marker.bindTooltip(`<b>${v.name}</b><br>${v.type} | ${v.speedKnots} kts`);
          
          marker.on('click', (e) => {
             L.DomEvent.stopPropagation(e);
             if (typeof openIntelDrawer === 'function') {
                 openIntelDrawer({ kind: 'sea', raw: v });
             }
          });
      });
  }

  /*
  if (L.heatLayer) {
    L.heatLayer(crimeScan.points.map((point) => [point.lat, point.lng, point.intensity]), {
      radius: 34,
      blur: 28,
      maxZoom: 15,
      minOpacity: 0.56,
      gradient: {
        0.18: 'rgba(255,184,77,0.46)',
        0.45: 'rgba(255,107,107,0.72)',
        0.72: 'rgba(198,40,40,0.88)',
        0.92: 'rgba(123,0,0,0.96)'
      }
    }).addTo(cityMapInstance);
  }
  */

  if (item.locationName === 'Pittsburgh, PA USA') {
    fetchJson(`data/pittsburgh/daily_crimes.json?t=${new Date().getTime()}`).then((crimes) => {
      if (!crimes) return;
      pittsburghCrimesData = crimes;
      pittsburghSelectedMonth = null; // reset so default kicks in
      syncPittsburghMonthControl(true);
      bindMonthSelect();
    }).catch(console.error);
  } else {
    /*
    crimeScan.points.forEach((point) => {
      const totalHtml = Object.entries(point.totals || {}).map(([crime, total]) => `
        <div style="display:flex; justify-content:space-between; gap:16px; margin-top:4px;">
          <span style="text-transform:capitalize;">${crime}</span>
          <strong>${total}</strong>
        </div>
      `).join('');

      const hotspotMarker = L.circleMarker([point.lat, point.lng], {
        radius: 4 + (point.intensity * 4),
        stroke: false,
        fillOpacity: 0.46,
        fillColor: point.intensity > 0.7 ? '#7b0000' : point.intensity > 0.5 ? '#b71c1c' : '#d84315'
      }).addTo(cityMapInstance).bindPopup(`
        <div style="min-width:220px; color:#111;">
          <div style="font-size:0.72rem; text-transform:uppercase; letter-spacing:0.08em; opacity:0.65;">Crime Scan</div>
          <div style="font-size:1rem; font-weight:700; margin-top:6px;">${point.zone}</div>
          <div style="margin-top:8px; font-size:0.85rem;">Intensity ${(point.intensity * 100).toFixed(0)}%</div>
          <div style="margin-top:10px; border-top:1px solid rgba(0,0,0,0.12); padding-top:8px;">
            ${totalHtml}
          </div>
        </div>
      `);
      hotspotMarker.on('click', (event) => {
        if (event.originalEvent && typeof L !== 'undefined') {
          L.DomEvent.stop(event.originalEvent);
        }
        hotspotMarker.openPopup();
      });
    });
    */
  }

  if (item.locationName === 'Pittsburgh, PA USA') {
    syncPittsburghZoneToggle(true, true);
    renderPittsburghZoneOverlay().catch(() => {
      syncPittsburghZoneToggle(false, false);
    });
  } else {
    syncPittsburghZoneToggle(false, false);
  }

  return crimeScan;
}

function showMapStage(item = {}) {
  const globe = document.getElementById('intel-globe');
  const mapStage = document.getElementById('intel-map-stage');
  const returnButton = document.getElementById('return-to-globe');
  const airButton = document.getElementById('toggle-air-layer');
  const satelliteButton = document.getElementById('toggle-satellite-layer');
  const threatButton = document.getElementById('toggle-threat-layer');
  const title = document.getElementById('globe-floating-title');
  if (!globe || !mapStage || typeof item.lat !== 'number' || typeof item.lng !== 'number') return;

  globe.style.display = 'none';
  mapStage.style.display = 'block';
  updatePrimaryStageHeight();
  renderCityCrimeMap(item);
  if (title) {
  if (title) title.textContent = `Map View · ${item.locationName || item.action || 'Location'}`;
    title.style.opacity = '1';
    title.style.color = '#000';
  }
  if (returnButton) returnButton.style.display = 'inline-flex';
  if (airButton) airButton.style.display = 'none';
  if (satelliteButton) satelliteButton.style.display = 'none';
  const seaButton = document.getElementById('toggle-sea-layer');
  if (seaButton) seaButton.style.display = 'none';
  if (threatButton) threatButton.style.display = 'none';
  const satOrbitFilters = document.getElementById('sat-orbit-filters');
  if (satOrbitFilters) satOrbitFilters.style.display = 'none';
}

function showGlobeStage() {
  const globe = document.getElementById('intel-globe');
  const mapStage = document.getElementById('intel-map-stage');
  const returnButton = document.getElementById('return-to-globe');
  const airButton = document.getElementById('toggle-air-layer');
  const satelliteButton = document.getElementById('toggle-satellite-layer');
  const threatButton = document.getElementById('toggle-threat-layer');
  const title = document.getElementById('globe-floating-title');
  if (!globe || !mapStage) return;

  globe.style.display = 'block';
  mapStage.style.display = 'none';
  const graphStage = document.getElementById('intel-graph-stage');
  if (graphStage) graphStage.style.display = 'none';
  const graphBtn = document.getElementById('toggle-ontology-graph');
  if (graphBtn) graphBtn.style.display = 'inline-flex';
  updatePrimaryStageHeight();
  destroyCityMap();
  if (pittsburghDangerLayer) { cityMapInstance?.removeLayer(pittsburghDangerLayer); pittsburghDangerLayer = null; }
  pittsburghDangerVisible = false;
  if (pittsburghHeatLayer) { pittsburghHeatLayer = null; }
  pittsburghHeatVisible = true;
  pittsburghMarkersVisible = false;
  if (mapStage) mapStage.innerHTML = '';
  syncPittsburghZoneToggle(true, false);
  if (title) {
  if (title) title.textContent = 'Global Operations Projection';
    title.style.color = '';
  }
  if (returnButton) returnButton.style.display = 'none';
  if (airButton) airButton.style.display = 'inline-flex';
  if (satelliteButton) satelliteButton.style.display = 'inline-flex';
  const seaButton = document.getElementById('toggle-sea-layer');
  if (seaButton) seaButton.style.display = 'inline-flex';
  if (threatButton) threatButton.style.display = 'inline-flex';
  const satOrbitFilters = document.getElementById('sat-orbit-filters');
  if (satOrbitFilters && satelliteLayerEnabled) satOrbitFilters.style.display = 'inline-flex';
  // Rotation removed — globe is static
}

function _initGlobeVars() {}
let intelGlobe = null; // globe.gl instance
let _lastGlobeDataHash = ''; // Skip redundant data updates
const stateColors = {
  'terminal': '#ff3366',
  'compromised': '#ff9933',
  'weakening': '#ffcc00',
  'contested': '#cccccc',
  'sound': '#33ccff',
  'fortified': '#33ff33',
  'neutral': '#666666'
};

// Globe data layers

function initOrUpdateGlobe(items = []) {
  applyInteractionMode();
  const globeContainer = document.getElementById('intel-globe');
  if (!globeContainer) return;

  updatePrimaryStageHeight();

  // Initialize globe.gl if not already done
  if (!intelGlobe) {
    // Wait for Globe library to load (may be deferred or slow CDN)
    if (typeof window.Globe === 'undefined' && typeof Globe === 'undefined') {
      console.warn('[Intel] Globe library not loaded, retrying in 500ms...');
      setTimeout(() => initOrUpdateGlobe(items), 500);
      return;
    }
    const GlobeLib = window.Globe || Globe;
    console.log('[Intel] Initializing globe with', GlobeLib.name || 'Globe');

    // Hide loading skeleton
    const loadEl = document.getElementById('globe-loading');
    if (loadEl) loadEl.remove();

    // Create globe.gl instance
    try {
      intelGlobe = GlobeLib()(globeContainer);
      intelGlobe.globeImageUrl('//unpkg.com/three-globe/example/img/earth-blue-marble.jpg');
      intelGlobe.backgroundImageUrl('//unpkg.com/three-globe/example/img/night-sky.png');
      intelGlobe.backgroundColor('#050505');
      intelGlobe.showAtmosphere(true);
      intelGlobe.atmosphereColor('#4488ff');
      intelGlobe.atmosphereAltitude(0.12);
      intelGlobe.showGraticules(false);
      intelGlobe.pointRadius(0.25);
      intelGlobe.pointAltitude(0.05);
      intelGlobe.pointResolution(12);
      intelGlobe.pointsMerge(false);
      intelGlobe.onPointClick(point => {
        if (point && point.raw) openIntelDrawer(point.raw);
      });
      intelGlobe.onPointHover(point => {
        const label = globeContainer.querySelector('.globe-hover-label');
        if (label) label.remove();
        if (point) {
          const el = document.createElement('div');
          el.className = 'globe-hover-label';
          el.style.cssText = 'position:absolute;pointer-events:none;background:rgba(32,33,36,0.85);color:#e8eaed;padding:4px 10px;border-radius:6px;font-size:12px;font-family:Google Sans,Roboto,sans-serif;white-space:nowrap;z-index:10;transform:translate(-50%,-100%);margin-top:-8px;';
          el.textContent = point.label || point.locationName || 'Unknown';
          globeContainer.appendChild(el);
        }
      });
      console.log('[Intel] Globe constructor OK');
      
      // Set initial dimensions
      intelGlobe.width(globeContainer.clientWidth || window.innerWidth);
      intelGlobe.height(globeContainer.clientHeight || window.innerHeight * 0.6);
      console.log('[Intel] Globe sized:', globeContainer.clientWidth, 'x', globeContainer.clientHeight);

    // Handle resize
    window.addEventListener('resize', () => {
      applyInteractionMode();
      updatePrimaryStageHeight();
      if (intelGlobe && intelGlobe.width && intelGlobe.height) {
        intelGlobe.width(globeContainer.clientWidth);
        intelGlobe.height(globeContainer.clientHeight);
      }
    });

    // Wire Map/Satellite toggle for globe view
    const mapStyleBtn = document.getElementById('toggle-map-style');
    if (mapStyleBtn && !mapStyleBtn.dataset.bound) {
      mapStyleBtn.addEventListener('click', () => {
        const isSatellite = mapStyleBtn.textContent.trim() === 'Satellite';
        if (isSatellite) {
          // Switch to map
          intelGlobe.globeImageUrl('//unpkg.com/three-globe/example/img/earth-topology.png');
          mapStyleBtn.textContent = 'Map';
        } else {
          // Switch to satellite
          intelGlobe.globeImageUrl('//unpkg.com/three-globe/example/img/earth-blue-marble.jpg');
          mapStyleBtn.textContent = 'Satellite';
        }
      });
      mapStyleBtn.dataset.bound = '1';
    }
  } catch(e) {
    console.error('[Intel] Globe creation failed:', e);
    // Show error details in container with readable font size
    const errMsg = e.message || e.toString();
    const errStack = (e.stack || '').split('\n').slice(0, 3).join('\n');
    globeContainer.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:40px 20px;text-align:center;font-family:monospace;"><div style="color:#ff4444;font-size:20px;margin-bottom:16px;">⚠ Globe Error</div><div style="color:#e8eaed;font-size:14px;margin-bottom:8px;word-break:break-all;">${errMsg}</div><div style="color:#888;font-size:11px;margin-bottom:20px;word-break:break-all;">${errStack}</div><button onclick="location.reload()" style="background:#00e676;color:#000;border:none;padding:12px 24px;border-radius:8px;font-size:16px;cursor:pointer;">Retry</button></div>`;
    return;
  }
  }

  // ── DATA RENDERING ────────────────────────────────────────
  // Skip redundant updates: hash the data to avoid re-rendering identical data
  const dataHash = items.length + ':' + (items[0]?.locationName || '') + ':' + (items[items.length-1]?.locationName || '');
  if (dataHash === _lastGlobeDataHash && intelGlobe) return; // No change, skip
  _lastGlobeDataHash = dataHash;

  const validItems = (items || []).filter(i => i.lat !== undefined && i.lng !== undefined);
  const touchBoost = ('ontouchstart' in window) ? 1.5 : 1;
  const cityPoints = validItems.map(item => {
    const structuralState = item.recoveryTrustDriverTransitionBalanceStructuralState || 'neutral';
    return {
      lat: item.lat,
      lng: item.lng,
      label: item.locationName || 'Unknown',
      raw: item,
      color: stateColors[structuralState] || stateColors['neutral'] || '#00e676',
      radius: 0.25 * touchBoost,
      altitude: 0
    };
  });

  // Hovered city ring points
  const hoveredCityPoints = (hoveredCity && hoveredCity.lat && hoveredCity.lng)
    ? [{ lat: hoveredCity.lat, lng: hoveredCity.lng, ringMaxRadius: 2, ringColor: hoveredCity.color || '#00ff88', ringPropagationTime: 3 }]
    : [];

  // Threat layer data
  const threatArcElements = threatLayerEnabled ? getThreatArcElements() : [];
  const threatArcData = threatArcElements.map(a => ({
    startLat: a.startLat, startLng: a.startLng,
    endLat: a.endLat, endLng: a.endLng,
    color: a.color || '#ff4444',
    arcAlt: a.arcAlt || 0.3
  }));

  // Overlay paths (flight paths, orbits)
  const overlayPaths = [];
  if (overlayFlightPaths && overlayFlightPaths.length) {
    overlayPaths.push(...overlayFlightPaths.filter(p => p.coords && p.coords.length >= 2).map(p => ({
      coords: p.coords.map(c => ({ lat: c.lat, lng: c.lng, alt: c.alt || 0.05 })),
      color: p.color || '#00ff88'
    })));
  }
  if (overlaySatelliteOrbits && overlaySatelliteOrbits.length) {
    overlayPaths.push(...overlaySatelliteOrbits.filter(p => p.coords && p.coords.length >= 2).map(p => ({
      coords: p.coords.map(c => ({ lat: c.lat, lng: c.lng, alt: c.alt || 0.2 })),
      color: p.color || '#4488ff'
    })));
  }
  // Add live satellite orbit paths from TLE data
  const satOrbitPaths = getSatelliteOrbitPaths();
  if (satOrbitPaths.length) {
    overlayPaths.push(...satOrbitPaths.map(p => ({
      coords: p.points,
      color: p.color
    })));
  }

  // Air traffic points
  const airPoints = airLayerEnabled ? currentAirTrafficItems.filter(a => a.lat && a.lng).map(a => ({
    lat: a.lat, lng: a.lng, label: a.callsign || 'Aircraft',
    raw: a, color: '#ffdd44', radius: 0.2, altitude: 0
  })) : [];

  // Satellite points (computed from TLE data)
  const satGlobeElements = getSatelliteGlobeElements();
  const satPoints = satGlobeElements.filter(s => s.lat && s.lng).map(s => ({
    lat: s.lat, lng: s.lng, label: s.label,
    raw: s.raw, color: s.raw.orbitClass === 'GEO' ? '#ff4444' : s.raw.orbitClass === 'MEO' ? '#44ddff' : '#44ff44',
    radius: 0.35, altitude: s.altitude || 0.08
  }));

  // Sea vessel points
  const seaPoints = seaLayerEnabled ? currentVesselCatalog.filter(v => v.lat && v.lng).map(v => ({
    lat: v.lat, lng: v.lng, label: v.name || 'Vessel',
    raw: v, color: (v.type === 'Tanker' || v.type === 'LNG Carrier') ? '#ff8844' : '#4488ff',
    radius: 0.2, altitude: 0
  })) : [];

  // Threat hotspot points
  const threatPoints = threatLayerEnabled ? threatHotspots.filter(t => t.lat && t.lng).map(t => ({
    lat: t.lat, lng: t.lng, label: t.description || 'Threat Hotspot',
    raw: t, color: '#ff2222', radius: 0.3, altitude: 0
  })) : [];

  // Combine all point layers
  const allPoints = [...cityPoints, ...airPoints, ...satPoints, ...seaPoints, ...threatPoints];

  // HTML element markers: city tooltips only (DOM overlay for interaction)
  const htmlCityMarkers = cityPoints.filter(p => p.lat && p.lng).map(p => ({
    lat: p.lat, lng: p.lng, altitude: 0.01,
    type: 'city', color: p.color, label: p.label, raw: p.raw
  }));

  // Update globe data
  try {
    intelGlobe.pointsData(allPoints);
    intelGlobe.pointColor(d => d.color);
    intelGlobe.pointRadius(d => d.radius);
    intelGlobe.pointAltitude(d => d.altitude || 0);
    intelGlobe.pointsMerge(false);
    // City tooltip HTML elements only (5 max, performant)
    intelGlobe.htmlElementsData(htmlCityMarkers);
    intelGlobe.htmlElement(d => {
      const el = document.createElement('div');
      const stateColor = d.color || '#00e676';
      const name = (d.raw && (d.raw.locationName || d.label)) || '';
      el.style.cssText = `position:relative;transform:translate(-50%,-100%);cursor:pointer;pointer-events:auto;white-space:nowrap;`;
      el.innerHTML = `<div style="display:flex;align-items:center;gap:4px;background:rgba(10,11,14,0.92);border:1px solid ${stateColor};border-radius:4px;padding:2px 7px 2px 5px;font-size:11px;color:#e8eaed;pointer-events:auto;"><span style="width:6px;height:6px;border-radius:50%;background:${stateColor};flex-shrink:0;"></span>${name}</div>`;
      el.addEventListener('click', () => { if (d.raw) openIntelDrawer(d.raw); });
      return el;
    });
    intelGlobe.htmlAltitude(d => d.altitude || 0.01);
    intelGlobe.htmlElementVisibilityModifier((el, isVisible) => { el.style.opacity = isVisible ? '1' : '0'; });
    intelGlobe.arcsData(threatArcData);
    intelGlobe.arcColor(d => d.color);
    intelGlobe.arcStroke(1);
    intelGlobe.arcAltitude(d => d.arcAlt || 0.3);
    intelGlobe.ringsData(threatLayerEnabled ? [...hoveredCityPoints, ...getThreatHotspotPoints().filter(p => p.ringMaxRadius > 0)] : hoveredCityPoints);
    intelGlobe.ringColor(d => d.ringColor || '#ff4444');
    intelGlobe.ringMaxRadius(d => d.ringMaxRadius || 1);
    intelGlobe.ringPropagationSpeed(1);
    intelGlobe.ringRepeatPeriod(2000);
    intelGlobe.pathsData(overlayPaths);
    intelGlobe.pathPoints(d => d.coords);
    intelGlobe.pathColor(d => d.color);
    intelGlobe.pathPointAlt(d => d.alt);
    intelGlobe.pathStroke(2);
  } catch(e) { console.error('[Intel] Globe data error:', e); }

  // Hover guard
  if (!globeContainer.dataset.hoverGuardBound) {
    globeContainer.addEventListener('pointermove', () => {
      const label = globeContainer.querySelector('.globe-hover-label');
      if (label) label.remove();
    });
    globeContainer.addEventListener('pointerleave', () => {
      const label = globeContainer.querySelector('.globe-hover-label');
      if (label) label.remove();
    });
    globeContainer.dataset.hoverGuardBound = '1';
  }

  updateGlobeLabelVisibility();
  if (typeof updateDataPanel === 'function') updateDataPanel();

  if (!globeContainer.dataset.initialViewLocked) {
    if (cityPoints.length > 0) {
      const avgLat = cityPoints.reduce((sum, point) => sum + point.lat, 0) / cityPoints.length;
      const avgLng = cityPoints.reduce((sum, point) => sum + point.lng, 0) / cityPoints.length;
      intelGlobe.pointOfView({ lat: avgLat, lng: avgLng, altitude: 1.7 }, 1800);
    } else {
      intelGlobe.pointOfView({ lat: 39.0, lng: -98.0, altitude: 1.7 }, 1800);
    }
    globeContainer.dataset.initialViewLocked = '1';
  }
}function showGraphStage() {
  const globe = document.getElementById('intel-globe');
  const mapStage = document.getElementById('intel-map-stage');
  const graphStage = document.getElementById('intel-graph-stage');
  const returnButton = document.getElementById('return-to-globe');
  const graphButton = document.getElementById('toggle-ontology-graph');
  
  if (globe) globe.style.display = 'none';
  if (mapStage) mapStage.style.display = 'none';
  if (graphStage) graphStage.style.display = 'block';
  if (returnButton) returnButton.style.display = 'inline-flex';
  if (graphButton) graphButton.style.display = 'none';
  
  updatePrimaryStageHeight();
  console.log("Intel Graph: Toggled visibility, rendering...");
  if (typeof renderOntologyGraph === 'function') renderOntologyGraph();
  if (graphInstance) {
      setTimeout(() => {
          const w = graphStage.clientWidth || window.innerWidth;
          const h = graphStage.clientHeight || (window.innerHeight * 0.6);
          graphInstance.width(w).height(h);
      }, 50);
  }
}

function updatePrimaryStageHeight() {
  const card = document.getElementById('global-operations-card');
  const globe = document.getElementById('intel-globe');
  const mapStage = document.getElementById('intel-map-stage');
  const graphStage = document.getElementById('intel-graph-stage');
  if (!card || !globe || !mapStage) return;

  let targetHeight;
  if (window.innerWidth <= 920) {
    targetHeight = window.innerHeight; // Full viewport on mobile
  } else {
    const top = card.getBoundingClientRect().top;
    const reservedBelow = 32; // Minimal bottom padding
    targetHeight = Math.max(400, window.innerHeight - top - reservedBelow);
  }

  card.style.height = `${targetHeight}px`;
  globe.style.height = `${targetHeight}px`;
  mapStage.style.height = `${targetHeight}px`;
  if (graphStage) graphStage.style.height = `${targetHeight}px`;


  // globe.gl resize via width/height
  if (intelGlobe && typeof intelGlobe.width === 'function') {
    const gc = document.getElementById('intel-globe');
    if (gc) {
      intelGlobe.width(gc.clientWidth);
      intelGlobe.height(gc.clientHeight);
    }
  }
}
let graphInstance = null;

window.fullOntologyData = null;
window.expandedNodes = new Set();

function getVisibleOntology(clickedNode = null) {
    if (!window.fullOntologyData) return { nodes: [], links: [] };
    
    const visibleNodes = new Set();
    // Always show Nexus (0), Regions (3), Themes (4)
    window.fullOntologyData.nodes.forEach(n => {
        if (n.group === 0 || n.group === 3 || n.group === 4) {
            visibleNodes.add(n.id);
        }
    });
    
    // Add signals connected to expanded hubs
    window.fullOntologyData.links.forEach(l => {
        const sId = typeof l.source === 'object' ? l.source.id : l.source;
        const tId = typeof l.target === 'object' ? l.target.id : l.target;
        if (window.expandedNodes.has(sId)) visibleNodes.add(tId);
        if (window.expandedNodes.has(tId)) visibleNodes.add(sId);
    });
    
    const outNodes = window.fullOntologyData.nodes.filter(n => visibleNodes.has(n.id));
    
    // Spawning animation logic
    if (clickedNode && window.expandedNodes.has(clickedNode.id)) {
        outNodes.forEach(n => {
            if (n._collapsed && (n.group === 1 || n.group === 2)) {
                n.x = clickedNode.x + (Math.random() - 0.5) * 10;
                n.y = clickedNode.y + (Math.random() - 0.5) * 10;
                n.vx = 0;
                n.vy = 0;
            }
            n._collapsed = false;
        });
    }
    
    // Update collapsed state trackers
    window.fullOntologyData.nodes.forEach(n => {
        n._collapsed = !visibleNodes.has(n.id);
    });
    
    const outLinks = window.fullOntologyData.links.filter(l => {
        const sId = typeof l.source === 'object' ? l.source.id : l.source;
        const tId = typeof l.target === 'object' ? l.target.id : l.target;
        return visibleNodes.has(sId) && visibleNodes.has(tId);
    });
    
    return { nodes: outNodes, links: outLinks };
}

async function renderOntologyGraph() {
  const container = document.getElementById('intel-graph-stage');
  if (!container) return console.error("Intel Graph Error: #intel-graph-stage not found.");
  
  await ensureForceGraphLib();
  
  if (!graphInstance) {
    console.log("Intel Graph: Fetching ontology.json...");
    fetch('data/ontology.json?v=' + Date.now())
      .then(res => {
        if (!res.ok) throw new Error("Network response was not ok: " + res.status);
        return res.json();
      })
      .then(gData => {
        window.fullOntologyData = gData;
        window.expandedNodes = new Set();
        gData.nodes.forEach(n => n._collapsed = true);
        
        console.log("Intel Graph: Rendering with", gData.nodes.length, "nodes");
        container.style.display = 'block'; // Ensure it's not hidden while rendering
        graphInstance = ForceGraph()(container)
          .width(container.clientWidth || window.innerWidth)
          .height(container.clientHeight || (window.innerHeight * 0.6))
          .graphData(getVisibleOntology())
          .backgroundColor('#050505')
          .nodeRelSize(4)
          .nodeVal(node => node.size || 10)
          .nodeCanvasObjectMode(() => 'after')
          .nodeCanvasObject((node, ctx, globalScale) => {
             // Only draw permanent text labels for hubs (Nexus, Regions, Themes)
             if (node.group === 0 || node.group === 3 || node.group === 4) {
                 const label = node.label;
                 const fontSize = node.group === 0 ? 14/globalScale : 12/globalScale;
                 ctx.font = `${fontSize}px monospace`;
                 ctx.textAlign = 'center';
                 ctx.textBaseline = 'middle';
                 ctx.fillStyle = node.group === 0 ? 'rgba(0, 229, 255, 0.9)' : 'rgba(255, 255, 255, 0.7)';
                 
                 // Offset the text so it sits just below the node circle
                 const nodeRadius = Math.sqrt(node.size || 10) * 4;
                 ctx.fillText(label, node.x, node.y + nodeRadius + (6/globalScale));
             }
          })
          .nodeLabel(node => {
            if (node.image) {
                return `<div style="background: rgba(0,0,0,0.8); border: 1px solid #333; padding: 4px; border-radius: 4px; max-width: 220px;">
                          <img src="${node.image}" style="width: 100%; height: auto; border-radius: 2px; margin-bottom: 4px; display: block;">
                          <div style="color: #fff; font-family: monospace; font-size: 11px; white-space: normal;">${node.label}</div>
                        </div>`;
            }
            return `<div style="color: #fff; font-family: monospace; font-size: 11px; background: rgba(0,0,0,0.8); padding: 4px; border: 1px solid #333;">${node.label}</div>`;
          })
          .nodeColor(node => {
            if(node.group === 0) return '#00e5ff';
            if(node.group === 1) return '#ffffff';
            if(node.group === 2) return '#ff3c3c';
            if(node.group === 3) return '#ffb878';
            return '#00e564';
          })
          .linkColor(() => 'rgba(255,255,255,0.2)')
          .linkWidth(link => link.value || 1)
          .linkDirectionalParticles(2)
          .linkDirectionalParticleWidth(1.5)
          .onNodeClick(node => {
            // Toggle expansion logic for hub nodes (Groups 0, 3, 4)
            if (node.group === 0 || node.group === 3 || node.group === 4) {
                if (window.expandedNodes.has(node.id)) {
                    window.expandedNodes.delete(node.id);
                } else {
                    window.expandedNodes.add(node.id);
                }
                graphInstance.graphData(getVisibleOntology(node));
            }
            
            graphInstance.centerAt(node.x, node.y, 1000);
            graphInstance.zoom(2, 2000);
            
            // Query related items against the FULL dataset so everything shows up in the drawer
            const { nodes, links } = window.fullOntologyData;
            const relatedLinks = links.filter(l => {
                const sId = typeof l.source === 'object' ? l.source.id : l.source;
                const tId = typeof l.target === 'object' ? l.target.id : l.target;
                return sId === node.id || tId === node.id;
            });
            const relatedNodes = relatedLinks.map(l => {
                const sId = typeof l.source === 'object' ? l.source.id : l.source;
                const tId = typeof l.target === 'object' ? l.target.id : l.target;
                const otherId = sId === node.id ? tId : sId;
                return nodes.find(n => n.id === otherId) || { id: otherId };
            });
            
            if (typeof openIntelDrawer === 'function') {
                openIntelDrawer({
                    kind: 'graph-node',
                    node: node,
                    related: relatedNodes
                });
            }
          });
          
        graphInstance.d3Force('charge').strength(-600);
        graphInstance.d3Force('link').distance(70);
      })
      .catch(err => console.error("Intel Graph Error:", err));
  }
}
// --- Sidebar Injection ---

// Add blinking animation for the cursor
const style = document.createElement('style');
style.innerHTML = `
@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
`;
document.head.appendChild(style);

async function loadIntel() {
  try {
    syncUrlState();
    const params = buildFeedParams();

    const [signals, timelineViews] = await Promise.all([
      fetchJson(`api/signal-feed.php?${params.toString()}`).catch(() => ({ items: [] })),
      fetchJson('api/timeline-views.php').catch(() => ({ items: [] }))
    ]);

    renderTimelineViews(timelineViews.items || []);
    const globeSeed = await fetchJson('data/globe-demo-locations.json').catch(() => ({ items: [] }));
    
    currentPriorityItems = globeSeed.items || [];
    currentGlobeBaseItems = currentPriorityItems;
    
    await refreshAirTraffic();
    await refreshSatelliteCatalog();
    renderCommandBar(currentPriorityItems);
    
    if (typeof initOrUpdateGlobe === "function") initOrUpdateGlobe(currentGlobeBaseItems);
    if (typeof updateDataPanel === 'function') updateDataPanel();
    
    renderTimelineFocus(signals.items || []);
    renderTimeline(signals.items || []);
    syncTimelineWindowButtons();
    syncSeverityFilterButtons();
    syncFeedViewButtons();
    
    const feedStatus = document.getElementById('feed-status');
    if (feedStatus) {
      feedStatus.innerHTML = '<span class="live-dot">●</span> Live';
    }

    const overviewHeadline = document.getElementById('overview-headline');
    if (overviewHeadline) {
      overviewHeadline.textContent = 'Intel shell loaded.';
    }
  } catch (error) {
    console.error(error);
    const feedStatus = document.getElementById('feed-status');
    if (feedStatus) feedStatus.textContent = 'Disconnected';
  }
}


function updateDataPanel() {
  const container = document.getElementById('intel-live-triage');
  const title = document.getElementById('dynamic-panel-title');
  if (!container || !title) return;

  if (airLayerEnabled && currentAirTrafficItems && currentAirTrafficItems.length > 0) {
    title.textContent = 'Data Target: GLOBAL AIR TRAFFIC';
    const total = currentAirTrafficItems.length;
    let commercial = 0;
    let privateMil = 0;
    const countries = {};

    currentAirTrafficItems.forEach(f => {
      if (f.callsign && /^[A-Z]{3}[A-Z0-9]{1,5}$/i.test(f.callsign.trim())) {
        commercial++;
      } else {
        privateMil++;
      }
      const c = f.country || 'Unknown';
      countries[c] = (countries[c] || 0) + 1;
    });

    const topCountries = Object.entries(countries)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    let html = `
      <div style="display:flex; justify-content:space-between; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.1);">
        <div data-air-category="all" style="cursor:pointer; padding: 4px 6px; border-radius: 4px; background: ${!selectedAirCategory ? 'rgba(210,255,84,0.15)' : 'transparent'};">
          <div style="color:var(--lime); font-size:16px; font-weight:600;">${total}</div>
          <div class="muted" style="font-size:9px; text-transform:uppercase; color:${!selectedAirCategory ? '#fff' : ''}">Airborne Total</div>
        </div>
        <div data-air-category="commercial" style="cursor:pointer; padding: 4px 6px; border-radius: 4px; background: ${selectedAirCategory === 'commercial' ? 'rgba(210,255,84,0.15)' : 'transparent'};">
          <div style="color:#fff; font-size:16px; font-weight:600;">${commercial}</div>
          <div class="muted" style="font-size:9px; text-transform:uppercase; color:${selectedAirCategory === 'commercial' ? '#fff' : ''}">Commercial</div>
        </div>
        <div data-air-category="private" style="cursor:pointer; padding: 4px 6px; border-radius: 4px; background: ${selectedAirCategory === 'private' ? 'rgba(255,60,60,0.15)' : 'transparent'};">
          <div style="color:#ff3c3c; font-size:16px; font-weight:600;">${privateMil}</div>
          <div class="muted" style="font-size:9px; text-transform:uppercase; color:${selectedAirCategory === 'private' ? '#fff' : ''}">Private/Military</div>
        </div>
      </div>
      <div style="margin-bottom: 8px; font-size: 10px; color: #fff; text-transform: uppercase; letter-spacing: 0.05em;">Top 5 Regions of Origin</div>
    `;

    topCountries.forEach(([country, count], i) => {
      const isSelected = selectedAirRegion === country;
      html += `
        <div data-air-region="${country}" style="cursor:pointer; display:flex; justify-content:space-between; padding: 6px 4px; font-size: 11px; background: ${isSelected ? 'rgba(210,255,84,0.15)' : 'transparent'}; border-radius: 4px; transition: background 0.2s;">
          <span style="color:${isSelected ? '#fff' : '#ccc'}; font-weight:${isSelected ? 'bold' : 'normal'};">${i+1}. ${country}</span>
          <span style="color:var(--lime); font-family:var(--font-mono);">${count}</span>
        </div>
      `;
      
      // If selected, show deep dive
      if (isSelected) {
        const regionalFlights = currentAirTrafficItems.filter(f => f.country === country);
        
        // Count airlines
        const airlines = {};
        let rComm = 0;
        let rPriv = 0;
        
        regionalFlights.forEach(f => {
           let code = f.callsign ? f.callsign.substring(0, 3).toUpperCase() : 'UNK';
           if (/^[A-Z]{3}$/.test(code)) {
               rComm++;
               const map = {
                   'UAL': 'United', 'DAL': 'Delta', 'AAL': 'American', 'SWA': 'Southwest',
                   'UPS': 'UPS Cargo', 'FDX': 'FedEx Cargo', 'BAW': 'British Airways',
                   'AFR': 'Air France', 'DLH': 'Lufthansa', 'RYR': 'Ryanair', 'TVF': 'Transavia',
                   'UAE': 'Emirates', 'QFA': 'Qantas', 'CPA': 'Cathay Pacific', 'JAL': 'Japan Airlines',
                   'ANA': 'Japan Airlines', 'ACA': 'Air Canada', 'WJA': 'WestJet'
               };
               const name = map[code] || code;
               airlines[name] = (airlines[name] || 0) + 1;
           } else {
               rPriv++;
           }
        });
        
        const topAirlines = Object.entries(airlines).sort((a,b)=>b[1]-a[1]).slice(0, 4);
        
        // Mock pseudo-airports based on string length to look realistic but deterministic
        const pseudoAirports = country === 'United States' ? ['JFK', 'LAX', 'ORD', 'DFW', 'ATL', 'SFO', 'MIA'] :
                               country === 'France' ? ['CDG', 'ORY', 'NCE', 'MRS', 'MRS', 'LYS', 'TLS'] :
                               country === 'United Kingdom' ? ['LHR', 'LGW', 'MAN', 'STN', 'EDI', 'BHX'] :
                               country === 'Germany' ? ['FRA', 'MUC', 'BER', 'DUS', 'HAM', 'STR'] :
                               country === 'China' ? ['PEK', 'PVG', 'SHA', 'CAN', 'CTU', 'SZX'] :
                               ['HUB1', 'INTL', 'REG', 'MAIN', 'SEC', 'PORT'];
                               
        const deps = pseudoAirports.slice(0, 5).map((code, idx) => `<div>${idx+1}. ${code} <span class="muted" style="float:right">${Math.floor(regionalFlights.length * (0.3 - idx*0.05))}</span></div>`).join('');
        const arrs = pseudoAirports.slice().reverse().slice(0, 5).map((code, idx) => `<div>${idx+1}. ${code} <span class="muted" style="float:right">${Math.floor(regionalFlights.length * (0.28 - idx*0.05))}</span></div>`).join('');

        html += `
          <div style="margin: 4px 0 12px 12px; padding-left: 10px; border-left: 1px solid rgba(210,255,84,0.3);">
             <div style="font-size:10px; margin-bottom: 6px; color:#fff;">REGION METRICS: ${regionalFlights.length} TRACKED</div>
             
             <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin-bottom: 8px;">
               <div style="background:rgba(0,0,0,0.2); padding: 4px; border-radius: 4px;">
                 <div class="muted" style="font-size:9px;">Commercial</div>
                 <div style="color:#fff; font-size:12px;">${rComm}</div>
               </div>
               <div style="background:rgba(0,0,0,0.2); padding: 4px; border-radius: 4px;">
                 <div class="muted" style="font-size:9px;">Private / Mil</div>
                 <div style="color:#ff3c3c; font-size:12px;">${rPriv}</div>
               </div>
             </div>

             <div class="muted" style="font-size:9px; text-transform:uppercase; margin-bottom:4px;">Top Operators</div>
             <div style="font-size:10px; color:#ccc; margin-bottom:8px;">
               ${topAirlines.map(a => `<div style="display:flex; justify-content:space-between;"><span>${a[0]}</span><span style="color:var(--lime)">${a[1]}</span></div>`).join('')}
             </div>
             
             <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; font-size:9px; color:#ccc;">
               <div>
                 <div class="muted" style="text-transform:uppercase; margin-bottom:4px;">Top Departures</div>
                 ${deps}
               </div>
               <div>
                 <div class="muted" style="text-transform:uppercase; margin-bottom:4px;">Top Destinations</div>
                 ${arrs}
               </div>
             </div>
          </div>
        `;
      }
    });

    if (selectedAirIcao24) {
      const selectedFlight = currentAirTrafficItems.find(f => f.icao24 === selectedAirIcao24);
      if (selectedFlight) {
        html += `
          <div style="margin-top: 16px; padding: 8px; background: rgba(210,255,84,0.1); border-left: 2px solid var(--lime);">
            <div style="color:var(--lime); font-size:10px; text-transform:uppercase; margin-bottom:4px;">Selected Aircraft</div>
            <div style="color:#fff; font-size:12px; font-weight:bold;">${selectedFlight.callsign || 'N/A'}</div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:4px; margin-top:6px; font-size:10px;">
              <div><span class="muted">Alt:</span> ${Math.round((selectedFlight.altitude || 0)*3.28084)} ft</div>
              <div><span class="muted">Spd:</span> ${Math.round((selectedFlight.velocity || 0)*1.94384)} kts</div>
              <div style="grid-column: 1/-1;"><span class="muted">Orig:</span> ${selectedFlight.country || 'Unknown'}</div>
            </div>
          </div>
        `;
      }
    }

    container.innerHTML = html;
  } else if (seaLayerEnabled) {
    title.textContent = 'Data Target: MARITIME ZONES';
    
    let html = `
      <div style="margin-bottom: 16px;">
         <div data-sea-select="hormuz" style="cursor:pointer; display:flex; justify-content:space-between; align-items:center; padding: 8px 12px; margin-bottom: 8px; border-radius: 6px; border: 1px solid ${seaRegion === 'hormuz' ? 'var(--cyan)' : 'rgba(255,255,255,0.1)'}; background: ${seaRegion === 'hormuz' ? 'rgba(0,150,255,0.15)' : 'rgba(255,255,255,0.02)'}; transition:all 0.2s;">
            <div style="color:${seaRegion === 'hormuz' ? '#fff' : '#ccc'}; font-size:13px; font-weight:bold;">1. Strait of Hormuz</div>
            ${seaRegion === 'hormuz' ? '<div style="color:var(--cyan); font-size:10px; text-transform:uppercase; font-weight:bold;">Tracking</div>' : ''}
         </div>
         <div data-sea-select="mexico" style="cursor:pointer; display:flex; justify-content:space-between; align-items:center; padding: 8px 12px; margin-bottom: 8px; border-radius: 6px; border: 1px solid ${seaRegion === 'mexico' ? 'var(--cyan)' : 'rgba(255,255,255,0.1)'}; background: ${seaRegion === 'mexico' ? 'rgba(0,150,255,0.15)' : 'rgba(255,255,255,0.02)'}; transition:all 0.2s;">
            <div style="color:${seaRegion === 'mexico' ? '#fff' : '#ccc'}; font-size:13px; font-weight:bold;">2. Gulf of Mexico</div>
            ${seaRegion === 'mexico' ? '<div style="color:var(--cyan); font-size:10px; text-transform:uppercase; font-weight:bold;">Tracking</div>' : ''}
         </div>
      </div>
    `;

    if (seaRegion && currentVesselCatalog && currentVesselCatalog.length > 0) {
        const total = currentVesselCatalog.length;
        let tankers = 0, cargo = 0;
        const flags = {};
        
        currentVesselCatalog.forEach(v => {
            if (v.type === 'Tanker' || v.type === 'LNG Carrier') tankers++;
            else cargo++;
            const f = v.flag || 'Unknown';
            flags[f] = (flags[f] || 0) + 1;
        });
        
        const topFlags = Object.entries(flags)
            .sort((a,b) => b[1] - a[1])
            .slice(0, 5);
            
        html += `
          <div style="display:flex; justify-content:space-between; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.1);">
            <div data-sea-type="all" style="cursor:pointer; padding: 4px 6px; border-radius: 4px; background: ${!selectedSeaType ? 'rgba(0,150,255,0.15)' : 'transparent'};">
              <div style="color:#0096ff; font-size:16px; font-weight:600;">${total}</div>
              <div class="muted" style="font-size:9px; text-transform:uppercase; color:${!selectedSeaType ? '#fff' : ''}">Vessels</div>
            </div>
            <div data-sea-type="Tanker" style="cursor:pointer; padding: 4px 6px; border-radius: 4px; background: ${selectedSeaType === 'Tanker' ? 'rgba(255,165,0,0.15)' : 'transparent'};">
              <div style="color:orange; font-size:16px; font-weight:600;">${tankers}</div>
              <div class="muted" style="font-size:9px; text-transform:uppercase; color:${selectedSeaType === 'Tanker' ? '#fff' : ''}">Tankers</div>
            </div>
            <div data-sea-type="Cargo" style="cursor:pointer; padding: 4px 6px; border-radius: 4px; background: ${selectedSeaType === 'Cargo' ? 'rgba(0,150,255,0.15)' : 'transparent'};">
              <div style="color:#0096ff; font-size:16px; font-weight:600;">${cargo}</div>
              <div class="muted" style="font-size:9px; text-transform:uppercase; color:${selectedSeaType === 'Cargo' ? '#fff' : ''}">Cargo</div>
            </div>
          </div>
          <div style="margin-bottom: 8px; font-size: 10px; color: #fff; text-transform: uppercase; letter-spacing: 0.05em;">Vessels by Flag</div>
        `;
        
        topFlags.forEach(([flag, count], i) => {
            const isSelected = selectedSeaFlag === flag;
            html += `
            <div data-sea-flag="${flag}" style="cursor:pointer; display:flex; justify-content:space-between; padding: 6px 4px; font-size: 11px; background: ${isSelected ? 'rgba(0,150,255,0.15)' : 'transparent'}; border-radius: 4px; transition: background 0.2s;">
              <span style="color:${isSelected ? '#fff' : '#ccc'}; font-weight:${isSelected ? 'bold' : 'normal'};">${i+1}. ${flag}</span>
              <span style="color:#0096ff; font-family:var(--font-mono);">${count}</span>
            </div>
            `;
        });
    } else if (!seaRegion) {
        html += '<div class="muted" style="font-size:12px; margin-top:16px; padding:12px; border-left:2px solid var(--cyan); background:rgba(0,150,255,0.05);">Awaiting zone selection. Click a maritime region above to initialize live AIS tracking.</div>';
    }
    
    container.innerHTML = html;
    
    if (!container.dataset.seaBound) {
      container.addEventListener('click', (event) => {
        const selBtn = event.target.closest('[data-sea-select]');
        if (selBtn) {
            const r = selBtn.dataset.seaSelect;
            if (seaRegion !== r) {
                seaRegion = r;
                selectedSeaType = null;
                selectedSeaFlag = null;
                refreshMaritimeCatalog(true);
            }
            return;
        }
        const typeBtn = event.target.closest('[data-sea-type]');
        if (typeBtn) {
          const type = typeBtn.dataset.seaType;
          if (type === 'all' || selectedSeaType === type) selectedSeaType = null;
          else selectedSeaType = type;
          selectedSeaFlag = null;
          initOrUpdateGlobe(currentGlobeBaseItems || []);
          updateDataPanel();
          return;
        }
        const flagBtn = event.target.closest('[data-sea-flag]');
        if (flagBtn) {
          const flag = flagBtn.dataset.seaFlag;
          if (selectedSeaFlag === flag) selectedSeaFlag = null;
          else selectedSeaFlag = flag;
          selectedSeaType = null;
          initOrUpdateGlobe(currentGlobeBaseItems || []);
          updateDataPanel();
          return;
        }
      });
      container.dataset.seaBound = '1';
    }
  } else if (satelliteLayerEnabled && currentSatelliteCatalog && currentSatelliteCatalog.length > 0) {
    title.textContent = 'Data Target: SATELLITE ORBITS';
    const total = currentSatelliteCatalog.length;
    let leo = 0, meo = 0, geo = 0;
    const networks = {};
    
    currentSatelliteCatalog.forEach(sat => {
        if (sat.orbitClass === 'LEO') leo++;
        else if (sat.orbitClass === 'GEO') geo++;
        else meo++;
        
        const net = sat.network || 'Unknown';
        networks[net] = (networks[net] || 0) + 1;
    });
    
    const topNetworks = Object.entries(networks)
        .sort((a,b) => b[1] - a[1])
        .slice(0, 10);
        
    let html = `
      <div style="display:flex; justify-content:space-between; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.1);">
        <div data-sat-orbit="all" style="cursor:pointer; padding: 4px 6px; border-radius: 4px; background: ${!selectedSatOrbit ? 'rgba(0,229,255,0.15)' : 'transparent'};">
          <div style="color:var(--cyan); font-size:16px; font-weight:600;">${total}</div>
          <div class="muted" style="font-size:9px; text-transform:uppercase; color:${!selectedSatOrbit ? '#fff' : ''}">Tracked Total</div>
        </div>
        <div data-sat-orbit="LEO" style="cursor:pointer; padding: 4px 6px; border-radius: 4px; background: ${selectedSatOrbit === 'LEO' ? 'rgba(0,229,100,0.15)' : 'transparent'};">
          <div style="color:#00e564; font-size:16px; font-weight:600;">${leo}</div>
          <div class="muted" style="font-size:9px; text-transform:uppercase; color:${selectedSatOrbit === 'LEO' ? '#fff' : ''}">LEO</div>
        </div>
        <div data-sat-orbit="MEO" style="cursor:pointer; padding: 4px 6px; border-radius: 4px; background: ${selectedSatOrbit === 'MEO' ? 'rgba(0,229,255,0.15)' : 'transparent'};">
          <div style="color:#00e5ff; font-size:16px; font-weight:600;">${meo}</div>
          <div class="muted" style="font-size:9px; text-transform:uppercase; color:${selectedSatOrbit === 'MEO' ? '#fff' : ''}">MEO</div>
        </div>
        <div data-sat-orbit="GEO" style="cursor:pointer; padding: 4px 6px; border-radius: 4px; background: ${selectedSatOrbit === 'GEO' ? 'rgba(255,60,60,0.15)' : 'transparent'};">
          <div style="color:#ff3c3c; font-size:16px; font-weight:600;">${geo}</div>
          <div class="muted" style="font-size:9px; text-transform:uppercase; color:${selectedSatOrbit === 'GEO' ? '#fff' : ''}">GEO</div>
        </div>
      </div>
      <div style="margin-bottom: 8px; font-size: 10px; color: #fff; text-transform: uppercase; letter-spacing: 0.05em;">Top Constellations</div>
    `;
    
    topNetworks.forEach(([net, count], i) => {
        const isSelected = selectedSatNetwork === net;
        html += `
        <div data-sat-network="${net}" style="cursor:pointer; display:flex; justify-content:space-between; padding: 6px 4px; font-size: 11px; background: ${isSelected ? 'rgba(0,229,255,0.15)' : 'transparent'}; border-radius: 4px; transition: background 0.2s;">
          <span style="color:${isSelected ? '#fff' : '#ccc'}; font-weight:${isSelected ? 'bold' : 'normal'};">${i+1}. ${net}</span>
          <span style="color:var(--cyan); font-family:var(--font-mono);">${count}</span>
        </div>
        `;
    });
    
    container.innerHTML = html;
    
    // Bind click events if not already bound via a delegated handler
    if (!container.dataset.satBound) {
      container.addEventListener('click', (event) => {
        const orbitBtn = event.target.closest('[data-sat-orbit]');
        if (orbitBtn) {
          const orbit = orbitBtn.dataset.satOrbit;
          if (orbit === 'all') {
             selectedSatOrbit = null;
          } else if (selectedSatOrbit === orbit) {
             selectedSatOrbit = null;
          } else {
             selectedSatOrbit = orbit;
          }
          selectedSatNetwork = null; // Clear network when orbit is toggled
          if (typeof initOrUpdateGlobe === 'function') initOrUpdateGlobe(currentGlobeBaseItems || []);
          if (typeof updateDataPanel === 'function') updateDataPanel();
          return;
        }
        
        const netBtn = event.target.closest('[data-sat-network]');
        if (netBtn) {
          const net = netBtn.dataset.satNetwork;
          if (selectedSatNetwork === net) {
              selectedSatNetwork = null;
          } else {
              selectedSatNetwork = net;
          }
          selectedSatOrbit = null; // Clear orbit when network is toggled
          if (typeof initOrUpdateGlobe === 'function') initOrUpdateGlobe(currentGlobeBaseItems || []);
          if (typeof updateDataPanel === 'function') updateDataPanel();
          return;
        }
      });
      container.dataset.satBound = '1';
    }
  } else {
    title.textContent = 'Data Target: GLOBAL ZONES';
    let html = '';
    const threats = currentPriorityItems.slice(0, 5);
    threats.forEach(t => {
      const severityColor = t.recoveryTrustDriverTransitionBalanceStructuralState === 'terminal' ? '#ff3c3c' : (t.recoveryTrustDriverTransitionBalanceStructuralState === 'fortified' ? 'var(--lime)' : '#ffb878');
      html += `
        <div style="border-left: 2px solid ${severityColor}; padding: 6px 8px; margin-bottom: 8px; background: rgba(255,255,255,0.02);">
          <div style="color: ${severityColor}; margin-bottom: 4px;">[${t.recoveryTrustDriverTransitionBalanceStructuralState ? t.recoveryTrustDriverTransitionBalanceStructuralState.toUpperCase() : 'ALERT'}]</div>
          <div style="color: #fff;">${t.action || t.locationName || 'Zone Alert'}</div>
          <div class="muted" style="font-size: 9px; margin-top: 4px;">${new Date().toISOString().substring(11, 19)}Z</div>
        </div>
      `;
    });
    if (html === '') {
       html = '<div class="muted">No active zones detected.</div>';
    }
    container.innerHTML = html;
  }
}

// ── Boot: ensure globe initializes after DOM + scripts ready ──
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (!intelGlobe && typeof (window.Globe || Globe) !== 'undefined') {
      initOrUpdateGlobe(currentGlobeBaseItems || []);
    }
  });
} else {
  // DOM already parsed
  if (!intelGlobe && typeof (window.Globe || Globe) !== 'undefined') {
    setTimeout(() => initOrUpdateGlobe(currentGlobeBaseItems || []), 100);
  }
}

