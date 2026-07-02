/**
 * TimelineEngine — Rewind Time Scrubber for Intel Globe v2
 *
 * Captures snapshots of all live data sources every 5 minutes,
 * stores up to 288 snapshots (24 hours), and provides a scrubber
 * UI to replay the past 24 hours of data.
 *
 * Inspired by Persistent Surveillance Systems — replay any moment.
 *
 * Usage:
 *   const tl = new TimelineEngine({ globe: myGlobe });
 *   tl.startCapture();
 *   // Data sources register via:
 *   tl.registerDataSource('flights', async () => { return await fetchFlights(); });
 *   tl.registerDataSource('earthquakes', async () => { return await fetchEarthquakes(); });
 *
 * Dependencies: Three.js (for globe interaction), extended-layers.css
 */

class TimelineEngine {
  constructor(options = {}) {
    this.config = {
      maxSnapshots: 288,         // 24h × 12 snapshots/hour (5-min intervals)
      snapshotIntervalMs: 5 * 60 * 1000,  // 5 minutes
      globe: options.globe || null,
      autoStartCapture: options.autoStartCapture !== false,
      container: options.container || document.body,
    };

    // Snapshot storage
    this.snapshots = [];          // [{timestamp, flights, earthquakes, alerts, cameras, fires, ships}]
    this.maxSnapshots = this.config.maxSnapshots;
    this.currentMode = 'live';   // 'live' | 'rewind'
    this.playbackSpeed = 1;      // 1, 5, 30, 120
    this.playheadIndex = -1;     // -1 = live edge
    this.isPlaying = false;

    // Data source registry
    this.dataSources = new Map(); // key → async fetcher function

    // Intervals
    this.snapshotInterval = null;
    this.playbackInterval = null;
    this.playbackLastTick = 0;

    // Event markers (notable events extracted from snapshots)
    this.eventMarkers = [];

    // Callbacks for data injection
    this.onRewindData = null;     // Called with snapshot data when in rewind mode
    this.onLiveData = null;       // Called when returning to live mode
    this.onModeChange = null;     // Called when mode changes

    // UI elements
    this.ui = null;
    this.scrubberBar = null;
    this.playhead = null;
    this.timestampDisplay = null;
    this.speedSelector = null;
    this.playButton = null;
    this.liveButton = null;
    this.densityCanvas = null;

    // State
    this._isDragging = false;
    this._captureInProgress = false;

    this._initUI();
  }

  // ────────────────────────────────────────────────────────────
  //  Data Source Registration
  // ────────────────────────────────────────────────────────────

  /**
   * Register a data source that the timeline can capture.
   * @param {string} key - e.g. 'flights', 'earthquakes', 'fires', 'ships'
   * @param {Function} fetcher - async function returning data array
   */
  registerDataSource(key, fetcher) {
    this.dataSources.set(key, fetcher);
  }

  // ────────────────────────────────────────────────────────────
  //  Snapshot Capture
  // ────────────────────────────────────────────────────────────

  /**
   * Start capturing snapshots every 5 minutes.
   */
  startCapture() {
    if (this.snapshotInterval) return;

    // Capture immediately
    this._captureSnapshot();

    // Then on interval
    this.snapshotInterval = setInterval(() => {
      this._captureSnapshot();
    }, this.config.snapshotIntervalMs);
  }

  /**
   * Stop capturing snapshots.
   */
  stopCapture() {
    if (this.snapshotInterval) {
      clearInterval(this.snapshotInterval);
      this.snapshotInterval = null;
    }
  }

  async _captureSnapshot() {
    if (this._captureInProgress) return;
    this._captureInProgress = true;

    const timestamp = Date.now();
    const snapshot = { timestamp, __keys: [] };

    // Fetch all registered data sources in parallel
    const entries = Array.from(this.dataSources.entries());
    const results = await Promise.allSettled(
      entries.map(async ([key, fetcher]) => {
        try {
          const data = await fetcher();
          return [key, data];
        } catch (err) {
          console.warn(`[Timeline] Failed to capture "${key}":`, err);
          return [key, null];
        }
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        const [key, data] = result.value;
        snapshot[key] = data;
        snapshot.__keys.push(key);
      }
    }

    // Add to snapshots, maintaining max size
    this.snapshots.push(snapshot);
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }

    // Extract event markers from this snapshot
    this._extractEventMarkers(snapshot);

    // Update density visualization
    this._updateDensityCanvas();

    this._captureInProgress = false;
  }

  /**
   * Extract notable events from a snapshot for timeline markers.
   */
  _extractEventMarkers(snapshot) {
    const markers = [];

    // Earthquakes — any M3.0+
    if (snapshot.earthquakes && Array.isArray(snapshot.earthquakes)) {
      for (const eq of snapshot.earthquakes) {
        const mag = parseFloat(eq.magnitude || eq.mag || 0);
        if (mag >= 3.0) {
          markers.push({
            timestamp: snapshot.timestamp,
            type: 'earthquake',
            magnitude: mag,
            label: `M${mag.toFixed(1)} ${eq.place || eq.location || ''}`.trim(),
            severity: mag >= 5.0 ? 'high' : mag >= 4.0 ? 'medium' : 'low',
          });
        }
      }
    }

    // Weather alerts — severe
    if (snapshot.alerts && Array.isArray(snapshot.alerts)) {
      for (const alert of snapshot.alerts) {
        const severity = (alert.severity || '').toLowerCase();
        if (severity === 'severe' || severity === 'extreme') {
          markers.push({
            timestamp: snapshot.timestamp,
            type: 'weather',
            label: alert.event || alert.title || 'Severe Weather',
            severity: severity === 'extreme' ? 'high' : 'medium',
          });
        }
      }
    }

    // Fires — high confidence + high FRP
    if (snapshot.fires && Array.isArray(snapshot.fires)) {
      const highConfFires = snapshot.fires.filter(f => {
        const conf = (f.confidence || '').toLowerCase();
        const frp = parseFloat(f.frp || 0);
        return (conf === 'high' || conf === 'h') && frp > 100;
      });
      if (highConfFires.length > 0) {
        markers.push({
          timestamp: snapshot.timestamp,
          type: 'fire',
          count: highConfFires.length,
          label: `${highConfFires.length} high-intensity fires`,
          severity: highConfFires.length > 20 ? 'high' : 'medium',
        });
      }
    }

    // Major incidents — flight count anomalies, ship clusters, etc.
    // (Could be extended with anomaly detection)

    if (markers.length > 0) {
      this.eventMarkers.push(...markers);
      // Keep markers within 24h window
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      this.eventMarkers = this.eventMarkers.filter(m => m.timestamp >= cutoff);
    }
  }

  // ────────────────────────────────────────────────────────────
  //  Mode Switching
  // ────────────────────────────────────────────────────────────

  /**
   * Enter rewind mode — stop live fetches, use cached snapshots.
   */
  enterRewindMode() {
    if (this.currentMode === 'rewind') return;
    this.currentMode = 'rewind';
    this.isPlaying = false;

    if (this.onModeChange) this.onModeChange('rewind');

    // Update UI
    this.ui?.classList.add('rewind-mode');
    this.liveButton?.classList.remove('active');

    // Dispatch event for globe to stop live fetches
    document.dispatchEvent(new CustomEvent('timeline:rewind', { detail: { mode: 'rewind' } }));
  }

  /**
   * Exit rewind mode — return to live data.
   */
  exitRewindMode() {
    if (this.currentMode === 'live') return;
    this.currentMode = 'live';
    this.isPlaying = false;
    this.playheadIndex = -1;

    if (this.onModeChange) this.onModeChange('live');

    // Stop playback
    if (this.playbackInterval) {
      clearInterval(this.playbackInterval);
      this.playbackInterval = null;
    }

    // Update UI
    this.ui?.classList.remove('rewind-mode');
    this.liveButton?.classList.add('active');
    this.playButton?.classList.remove('playing');
    this._updatePlayheadUI();
    this._updateTimestampDisplay();

    // Dispatch event for globe to resume live fetches
    document.dispatchEvent(new CustomEvent('timeline:live', { detail: { mode: 'live' } }));

    // Inject live data
    if (this.onLiveData) this.onLiveData();
  }

  /**
   * Toggle between live and rewind.
   */
  toggleMode() {
    if (this.currentMode === 'live') {
      if (this.snapshots.length > 0) {
        this.enterRewindMode();
        this.setPlayhead(this.snapshots.length - 1);
      }
    } else {
      this.exitRewindMode();
    }
  }

  // ────────────────────────────────────────────────────────────
  //  Playback Controls
  // ────────────────────────────────────────────────────────────

  /**
   * Jump to a specific snapshot by index.
   */
  setPlayhead(index) {
    if (index < 0 || index >= this.snapshots.length) return;

    this.playheadIndex = index;
    const snapshot = this.snapshots[index];

    if (this.onRewindData) {
      this.onRewindData(snapshot);
    }

    // Dispatch event with snapshot data
    document.dispatchEvent(new CustomEvent('timeline:snapshot', { detail: snapshot }));

    this._updatePlayheadUI();
    this._updateTimestampDisplay();
  }

  /**
   * Start playback — advance playhead at selected speed.
   */
  play() {
    if (this.currentMode !== 'rewind') return;
    if (this.snapshots.length === 0) return;

    // If at end, restart from beginning
    if (this.playheadIndex >= this.snapshots.length - 1) {
      this.playheadIndex = 0;
    }

    this.isPlaying = true;
    this.playButton?.classList.add('playing');

    this.playbackLastTick = performance.now();

    // Clear any existing interval
    if (this.playbackInterval) clearInterval(this.playbackInterval);

    // Advance at speed — base interval is 500ms per snapshot at 1x
    const baseIntervalMs = 500;
    const intervalMs = baseIntervalMs / this.playbackSpeed;

    this.playbackInterval = setInterval(() => {
      if (this.playheadIndex < this.snapshots.length - 1) {
        this.setPlayhead(this.playheadIndex + 1);
      } else {
        // Reached end — switch to live
        this.pause();
        this.exitRewindMode();
      }
    }, intervalMs);
  }

  /**
   * Pause playback.
   */
  pause() {
    this.isPlaying = false;
    this.playButton?.classList.remove('playing');

    if (this.playbackInterval) {
      clearInterval(this.playbackInterval);
      this.playbackInterval = null;
    }
  }

  /**
   * Toggle play/pause.
   */
  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  /**
   * Set playback speed.
   */
  setSpeed(speed) {
    this.playbackSpeed = speed;

    // Update UI
    this.speedSelector?.querySelectorAll('.tl-speed-btn').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.speed) === speed);
    });

    // If playing, restart with new speed
    if (this.isPlaying) {
      this.pause();
      this.play();
    }
  }

  /**
   * Jump to live mode.
   */
  jumpToLive() {
    this.exitRewindMode();
  }

  // ────────────────────────────────────────────────────────────
  //  Event Markers
  // ────────────────────────────────────────────────────────────

  /**
   * Get event markers within a time range.
   */
  getEventMarkers(startTime, endTime) {
    return this.eventMarkers.filter(m => {
      return m.timestamp >= startTime && m.timestamp <= endTime;
    });
  }

  // ────────────────────────────────────────────────────────────
  //  UI Construction
  // ────────────────────────────────────────────────────────────

  _initUI() {
    // Create timeline bar element
    this.ui = document.createElement('div');
    this.ui.id = 'timeline-bar';
    this.ui.className = 'glass timeline-bar';
    this.ui.innerHTML = `
      <div class="tl-left">
        <button class="tl-btn tl-play-btn" id="tl-play" title="Play / Pause">
          <svg class="tl-icon-play" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z"/>
          </svg>
          <svg class="tl-icon-pause" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="display:none">
            <path d="M6 19h4V5H6v14zM14 5v14h4V5h-4z"/>
          </svg>
        </button>
        <button class="tl-btn tl-live-btn active" id="tl-live" title="Jump to Live">
          <span class="tl-live-dot"></span>
          LIVE
        </button>
      </div>

      <div class="tl-center">
        <div class="tl-scrubber-wrapper">
          <canvas class="tl-density" id="tl-density"></canvas>
          <div class="tl-scrubber-track" id="tl-track">
            <div class="tl-scrubber-fill" id="tl-fill"></div>
            <div class="tl-playhead" id="tl-playhead">
              <div class="tl-playhead-handle"></div>
            </div>
            <div class="tl-event-markers" id="tl-markers"></div>
          </div>
          <div class="tl-timestamp-display" id="tl-timestamp">
            <span class="tl-ts-label">LIVE</span>
            <span class="tl-ts-time"></span>
          </div>
        </div>
      </div>

      <div class="tl-right">
        <div class="tl-speed-group" id="tl-speed">
          <button class="tl-speed-btn active" data-speed="1">1×</button>
          <button class="tl-speed-btn" data-speed="5">5×</button>
          <button class="tl-speed-btn" data-speed="30">30×</button>
          <button class="tl-speed-btn" data-speed="120">120×</button>
        </div>
      </div>
    `;

    this.config.container.appendChild(this.ui);

    // Cache element references
    this.playButton = this.ui.querySelector('#tl-play');
    this.liveButton = this.ui.querySelector('#tl-live');
    this.scrubberBar = this.ui.querySelector('#tl-track');
    this.playhead = this.ui.querySelector('#tl-playhead');
    this.scrubberFill = this.ui.querySelector('#tl-fill');
    this.timestampDisplay = this.ui.querySelector('#tl-timestamp');
    this.densityCanvas = this.ui.querySelector('#tl-density');
    this.speedSelector = this.ui.querySelector('#tl-speed');
    this.markersContainer = this.ui.querySelector('#tl-markers');
    this.tsLabel = this.ui.querySelector('.tl-ts-label');
    this.tsTime = this.ui.querySelector('.tl-ts-time');

    // Play/pause icons
    this.iconPlay = this.ui.querySelector('.tl-icon-play');
    this.iconPause = this.ui.querySelector('.tl-icon-pause');

    this._bindUIEvents();
    this._updateTimestampDisplay();
  }

  _bindUIEvents() {
    // Play/pause
    this.playButton.addEventListener('click', () => {
      if (this.currentMode === 'live') {
        // Switch to rewind mode first
        if (this.snapshots.length > 0) {
          this.enterRewindMode();
          this.setPlayhead(0);
        }
      }
      this.togglePlay();
      this._updatePlayIcon();
    });

    // LIVE button
    this.liveButton.addEventListener('click', () => {
      this.jumpToLive();
      this._updatePlayIcon();
    });

    // Speed buttons
    this.speedSelector.querySelectorAll('.tl-speed-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.setSpeed(parseInt(btn.dataset.speed));
      });
    });

    // Scrubber drag
    const track = this.scrubberBar;
    const handleDrag = (clientX) => {
      const rect = track.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const index = Math.floor(pct * (this.snapshots.length - 1));
      if (this.currentMode === 'live') {
        this.enterRewindMode();
      }
      this.setPlayhead(index);
    };

    track.addEventListener('mousedown', (e) => {
      this._isDragging = true;
      this.pause();
      handleDrag(e.clientX);
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (this._isDragging) handleDrag(e.clientX);
    });

    document.addEventListener('mouseup', () => {
      this._isDragging = false;
    });

    // Touch support
    track.addEventListener('touchstart', (e) => {
      this._isDragging = true;
      this.pause();
      handleDrag(e.touches[0].clientX);
      e.preventDefault();
    }, { passive: false });

    document.addEventListener('touchmove', (e) => {
      if (this._isDragging) handleDrag(e.touches[0].clientX);
    }, { passive: false });

    document.addEventListener('touchend', () => {
      this._isDragging = false;
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Only respond if timeline is active and no input is focused
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

      switch (e.key) {
        case ' ':
          // Space — play/pause
          if (this.currentMode === 'rewind' || this.snapshots.length > 0) {
            if (this.currentMode === 'live') {
              this.enterRewindMode();
              this.setPlayhead(0);
            }
            this.togglePlay();
            this._updatePlayIcon();
            e.preventDefault();
          }
          break;
        case 'l':
        case 'L':
          this.jumpToLive();
          this._updatePlayIcon();
          break;
        case 'ArrowLeft':
          if (this.currentMode === 'rewind' && this.playheadIndex > 0) {
            this.setPlayhead(this.playheadIndex - 1);
          }
          break;
        case 'ArrowRight':
          if (this.currentMode === 'rewind' && this.playheadIndex < this.snapshots.length - 1) {
            this.setPlayhead(this.playheadIndex + 1);
          }
          break;
      }
    });
  }

  _updatePlayIcon() {
    if (this.isPlaying) {
      this.iconPlay.style.display = 'none';
      this.iconPause.style.display = '';
    } else {
      this.iconPlay.style.display = '';
      this.iconPause.style.display = 'none';
    }
  }

  _updatePlayheadUI() {
    if (!this.playhead || !this.scrubberBar || this.snapshots.length === 0) return;

    const trackWidth = this.scrubberBar.offsetWidth;
    let pct;

    if (this.currentMode === 'live' || this.playheadIndex === -1) {
      pct = 1;
      this.playhead.style.opacity = '0.5';
    } else {
      pct = this.playheadIndex / Math.max(1, this.snapshots.length - 1);
      this.playhead.style.opacity = '1';
    }

    const x = pct * trackWidth;
    this.playhead.style.left = `${x}px`;
    this.scrubberFill.style.width = `${pct * 100}%`;
  }

  _updateTimestampDisplay() {
    if (!this.tsLabel || !this.tsTime) return;

    if (this.currentMode === 'live' || this.playheadIndex === -1) {
      this.tsLabel.textContent = 'LIVE';
      this.tsLabel.classList.add('live');
      this.tsTime.textContent = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        timeZone: 'UTC', hour12: false
      }) + ' UTC';
    } else {
      const snapshot = this.snapshots[this.playheadIndex];
      if (snapshot) {
        const date = new Date(snapshot.timestamp);
        this.tsLabel.textContent = 'REPLAY';
        this.tsLabel.classList.remove('live');
        this.tsTime.textContent = date.toLocaleTimeString('en-US', {
          hour: '2-digit', minute: '2-digit', second: '2-digit',
          timeZone: 'UTC', hour12: false
        }) + ' UTC · ' + date.toLocaleDateString('en-US', {
          month: 'short', day: 'numeric'
        });
      }
    }
  }

  _updateDensityCanvas() {
    if (!this.densityCanvas || this.snapshots.length === 0) return;

    const canvas = this.densityCanvas;
    const ctx = canvas.getContext('2d');

    // Match canvas size to display
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, rect.width, rect.height);

    // Draw density bars for each snapshot
    const barWidth = rect.width / this.maxSnapshots;
    const maxDensity = Math.max(1, ...this.snapshots.map(s => {
      let count = 0;
      for (const key of s.__keys || []) {
        if (Array.isArray(s[key])) count += s[key].length;
      }
      return count;
    }));

    for (let i = 0; i < this.snapshots.length; i++) {
      const snapshot = this.snapshots[i];
      let density = 0;
      for (const key of snapshot.__keys || []) {
        if (Array.isArray(snapshot[key])) density += snapshot[key].length;
      }

      const normalizedDensity = density / maxDensity;
      const barHeight = normalizedDensity * rect.height * 0.7;
      const x = i * barWidth;
      const y = rect.height - barHeight;

      // Color based on density
      const alpha = 0.15 + normalizedDensity * 0.55;
      ctx.fillStyle = `rgba(196, 214, 0, ${alpha})`;
      ctx.fillRect(x, y, Math.max(1, barWidth - 0.5), barHeight);
    }

    // Draw event markers
    if (this.snapshots.length > 0) {
      const startTime = this.snapshots[0].timestamp;
      const endTime = this.snapshots[this.snapshots.length - 1].timestamp;
      const timeSpan = endTime - startTime || 1;

      for (const marker of this.eventMarkers) {
        if (marker.timestamp < startTime || marker.timestamp > endTime) continue;

        const x = ((marker.timestamp - startTime) / timeSpan) * rect.width;

        let color;
        switch (marker.type) {
          case 'earthquake': color = '#ff453a'; break;
          case 'weather':    color = '#fbbf24'; break;
          case 'fire':       color = '#ff6b35'; break;
          default:           color = '#C4D600';
        }

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, 6, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Glow for high severity
        if (marker.severity === 'high') {
          ctx.fillStyle = color + '40';
          ctx.beginPath();
          ctx.arc(x, 6, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  /**
   * Refresh the density canvas and playhead position.
   * Call this when the container resizes.
   */
  refresh() {
    this._updateDensityCanvas();
    this._updatePlayheadUI();
  }

  /**
   * Destroy the timeline engine and clean up.
   */
  destroy() {
    this.stopCapture();
    this.pause();
    if (this.ui && this.ui.parentNode) {
      this.ui.parentNode.removeChild(this.ui);
    }
  }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.TimelineEngine = TimelineEngine;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TimelineEngine;
}