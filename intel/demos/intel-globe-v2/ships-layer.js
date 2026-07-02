/**
 * ShipsLayer — Live Global Ship Tracking for Intel Globe v2
 *
 * Primary:   aisstream.io WebSocket (real-time AIS positions)
 * Fallback:  PHP proxy REST endpoint (MarineTraffic scrape / synthetic)
 *
 * Features:
 *   - Ships as small cyan/blue triangles pointing in heading direction
 *   - Color by ship type: cargo=blue, tanker=yellow, passenger=green,
 *     fishing=orange, military=red, unknown=gray
 *   - Smooth interpolation between position updates
 *   - Layer toggle with live count
 *   - Hover tooltips: MMSI, speed, heading, ship type, destination
 *   - Click to highlight & follow a ship
 *   - WebSocket streams continuously; REST fallback every 2 min
 *
 * Usage:
 *   const ships = new ShipsLayer({
 *     globe: myGlobe,
 *     apiBase: '/intel/api',
 *     aisApiKey: 'YOUR_AISSTREAM_API_KEY', // get from aisstream.io
 *   });
 *   ships.init();
 *   ships.enable();
 *
 * Dependencies: Three.js, extended-layers.css
 */

class ShipsLayer {
  constructor(options = {}) {
    this.config = {
      globe: options.globe || null,
      apiBase: options.apiBase || '/intel/api',
      aisApiKey: options.aisApiKey || '',  // aisstream.io API key
      useWebSocket: options.aisApiKey ? true : false,
      restRefreshMs: 2 * 60 * 1000,       // 2 min for REST fallback
      maxShips: options.maxShips || 3000,
      dotScale: options.dotScale || 0.4,
      interpolateSpeed: options.interpolateSpeed || 0.05,  // lerp factor per frame
      // Bounding box for AIS subscription [minLat, minLng, maxLat, maxLng]
      aisBoundingBox: options.aisBoundingBox || [-90, -180, 90, 180],
    };

    // State
    this.enabled = false;
    this.ships = new Map();    // mmsi → { data, mesh, targetPos, currentPos, lastUpdate }
    this.group = null;
    this.ws = null;
    this.restInterval = null;
    this.animationFrame = null;
    this.hoveredShip = null;
    this.followedShip = null;  // MMSI of ship being followed
    this.connectionStatus = 'disconnected'; // 'connected' | 'disconnected' | 'fallback'

    // UI
    this.layerToggle = null;
    this.tooltip = null;
    this.statusIndicator = null;

    // Globe coordinate conversion
    this._lat2point = null;
  }

  // ────────────────────────────────────────────────────────────
  //  Initialization
  // ────────────────────────────────────────────────────────────

  init() {
    // Create Three.js group
    if (typeof THREE !== 'undefined') {
      this.group = new THREE.Group();
      this.group.name = 'ships-layer';
      this.group.visible = false;
    }

    // Create tooltip
    this._createTooltip();

    // Create layer toggle
    this._createLayerToggle();

    // Get coordinate conversion from globe
    if (this.config.globe) {
      const globe = this.config.globe;
      if (globe.getCoords) {
        this._lat2point = (lat, lng, alt = 0.01) => {
          const c = globe.getCoords(lat, lng, alt);
          return { x: c.x, y: c.y, z: c.z };
        };
      } else if (globe.toGeoCoords) {
        this._lat2point = (lat, lng, alt = 0.01) => globe.toGeoCoords(lat, lng, alt);
      }
    }

    // Fallback
    if (!this._lat2point) {
      this._lat2point = (lat, lng, alt = 0.01) => {
        const phi = (90 - lat) * (Math.PI / 180);
        const theta = (lng + 180) * (Math.PI / 180);
        const radius = 100 + alt * 10;
        return {
          x: -radius * Math.sin(phi) * Math.cos(theta),
          y: radius * Math.cos(phi),
          z: radius * Math.sin(phi) * Math.sin(theta),
        };
      };
    }
  }

  // ────────────────────────────────────────────────────────────
  //  Layer Toggle
  // ────────────────────────────────────────────────────────────

  _createLayerToggle() {
    const layersPanel = document.getElementById('layers-panel');
    if (!layersPanel) return;

    let section = layersPanel.querySelector('.layer-section-title[data-section="live-feeds"]');
    if (!section) {
      section = document.createElement('div');
      section.className = 'layer-section-title';
      section.dataset.section = 'live-feeds';
      section.textContent = 'LIVE FEEDS';
      layersPanel.appendChild(section);
    }

    const toggle = document.createElement('div');
    toggle.className = 'layer-toggle';
    toggle.innerHTML = `
      <input type="checkbox" class="lt-checkbox" id="lt-ships">
      <div class="lt-icon" style="color: #00d4ff;">🚢</div>
      <div class="lt-info">
        <div class="lt-name">Live Ships</div>
        <div class="lt-desc">AIS tracking · global</div>
      </div>
      <div class="lt-count" id="lt-ships-count">—</div>
    `;

    layersPanel.appendChild(toggle);
    this.layerToggle = toggle;

    const checkbox = toggle.querySelector('#lt-ships');
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) this.enable();
      else this.disable();
    });
  }

  // ────────────────────────────────────────────────────────────
  //  Tooltip
  // ────────────────────────────────────────────────────────────

  _createTooltip() {
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'ship-tooltip glass';
    this.tooltip.style.display = 'none';
    document.body.appendChild(this.tooltip);
  }

  _showTooltip(ship, x, y) {
    if (!this.tooltip) return;

    const typeColor = this._shipTypeColor(ship.shipType);
    const headingStr = ship.heading != null ? `${ship.heading.toFixed(0)}°` : 'N/A';

    this.tooltip.innerHTML = `
      <div class="st-header">
        <span class="st-icon" style="color:${typeColor};">🚢</span>
        <span class="st-title">${ship.name || 'Vessel ' + ship.mmsi}</span>
      </div>
      <div class="st-row"><span class="st-lbl">MMSI</span><span class="st-val">${ship.mmsi}</span></div>
      <div class="st-row"><span class="st-lbl">Type</span><span class="st-val" style="color:${typeColor};">${ship.shipType || 'Unknown'}</span></div>
      <div class="st-row"><span class="st-lbl">Speed</span><span class="st-val">${ship.speed != null ? ship.speed.toFixed(1) + ' kn' : 'N/A'}</span></div>
      <div class="st-row"><span class="st-lbl">Heading</span><span class="st-val">${headingStr}</span></div>
      <div class="st-row"><span class="st-lbl">Destination</span><span class="st-val">${ship.destination || 'N/A'}</span></div>
      <div class="st-row"><span class="st-lbl">Position</span><span class="st-val">${ship.lat.toFixed(3)}°, ${ship.lng.toFixed(3)}°</span></div>
      ${this.followedShip === ship.mmsi ? '<div class="st-following">● FOLLOWING</div>' : '<div class="st-hint">Click to follow</div>'}
    `;

    this.tooltip.style.display = 'block';
    this.tooltip.style.left = `${x + 14}px`;
    this.tooltip.style.top = `${y + 14}px`;
  }

  _hideTooltip() {
    if (this.tooltip) this.tooltip.style.display = 'none';
  }

  // ────────────────────────────────────────────────────────────
  //  Ship Type Colors
  // ────────────────────────────────────────────────────────────

  _shipTypeColor(type) {
    const t = (type || '').toLowerCase();
    if (t.includes('cargo'))   return '#3b9eff';  // Blue
    if (t.includes('tanker'))  return '#fbbf24';  // Yellow
    if (t.includes('passenger')) return '#22c55e'; // Green
    if (t.includes('fishing')) return '#ff8c42';  // Orange
    if (t.includes('military')) return '#ff453a'; // Red
    return '#888888';  // Gray for unknown
  }

  // ────────────────────────────────────────────────────────────
  //  WebSocket Connection (aisstream.io)
  // ────────────────────────────────────────────────────────────

  _connectWebSocket() {
    if (!this.config.aisApiKey) {
      console.log('[ShipsLayer] No AIS API key — using REST fallback');
      this._startRestFallback();
      return;
    }

    try {
      this.ws = new WebSocket('wss://stream.aisstream.io/v0/stream');

      this.ws.onopen = () => {
        console.log('[ShipsLayer] WebSocket connected to aisstream.io');
        this.connectionStatus = 'connected';
        this._updateStatusIndicator();

        // Subscribe with bounding box and API key
        const subscribeMsg = {
          APIKey: this.config.aisApiKey,
          BoundingBoxes: [[
            this.config.aisBoundingBox[0],
            this.config.aisBoundingBox[1],
            this.config.aisBoundingBox[2],
            this.config.aisBoundingBox[3],
          ]],
          FilterMessageTypes: ['PositionReport'],
        };
        this.ws.send(JSON.stringify(subscribeMsg));
      };

      this.ws.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data);
          // aisstream.io wraps AIS messages in an envelope
          const msg = raw.AISMessage || raw;

          // Position Report
          if (msg.MessageType === 'PositionReport' || msg.PositionReport) {
            const pos = msg.PositionReport || msg;
            const meta = msg.MetaData || raw.MetaData || {};

            const shipData = {
              mmsi: String(meta.MMSI || pos.MMSI || ''),
              name: meta.ShipName || '',
              lat: pos.Latitude || meta.Latitude,
              lng: pos.Longitude || meta.Longitude,
              speed: pos.Sog || pos.SOG || 0,  // Speed over ground
              heading: pos.Cog || pos.COG || 0, // Course over ground
              shipType: this._aisShipTypeToString(meta.ShipType || pos.Type),
              destination: meta.Destination || '',
              timestamp: Date.now(),
            };

            if (shipData.lat != null && shipData.lng != null) {
              this._upsertShip(shipData);
            }
          }
        } catch (e) {
          // Ignore malformed messages
        }
      };

      this.ws.onerror = (err) => {
        console.error('[ShipsLayer] WebSocket error:', err);
        this.connectionStatus = 'fallback';
        this._updateStatusIndicator();
        this._startRestFallback();
      };

      this.ws.onclose = () => {
        console.log('[ShipsLayer] WebSocket closed');
        if (this.enabled && this.config.useWebSocket) {
          this.connectionStatus = 'fallback';
          this._updateStatusIndicator();
          // Reconnect after 10 seconds
          setTimeout(() => {
            if (this.enabled) this._connectWebSocket();
          }, 10000);
          // Start REST fallback in the meantime
          if (!this.restInterval) this._startRestFallback();
        }
      };
    } catch (err) {
      console.error('[ShipsLayer] WebSocket init failed:', err);
      this._startRestFallback();
    }
  }

  _disconnectWebSocket() {
    if (this.ws) {
      this.ws.onclose = null;  // Prevent auto-reconnect
      this.ws.close();
      this.ws = null;
    }
    this.connectionStatus = 'disconnected';
  }

  _aisShipTypeToString(typeCode) {
    if (typeof typeCode === 'string') return typeCode;
    const code = parseInt(typeCode);
    if (isNaN(code)) return 'Unknown';
    // AIS ship type codes
    if (code >= 70 && code <= 79) return 'Cargo';
    if (code >= 80 && code <= 89) return 'Tanker';
    if (code >= 60 && code <= 69) return 'Passenger';
    if (code >= 30 && code <= 39) return 'Fishing';
    if (code === 35) return 'Military';
    if (code >= 50 && code <= 59) return 'Special Craft';
    return 'Unknown';
  }

  // ────────────────────────────────────────────────────────────
  //  REST Fallback
  // ────────────────────────────────────────────────────────────

  _startRestFallback() {
    if (this.restInterval) return;

    // Fetch immediately
    this._fetchRestShips();

    // Then every 2 minutes
    this.restInterval = setInterval(() => {
      this._fetchRestShips();
    }, this.config.restRefreshMs);
  }

  _stopRestFallback() {
    if (this.restInterval) {
      clearInterval(this.restInterval);
      this.restInterval = null;
    }
  }

  async _fetchRestShips() {
    const url = `${this.config.apiBase}/extended-feeds.php?source=ships`;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const ships = data.items || [];

      // Batch upsert
      for (const ship of ships) {
        this._upsertShip({
          ...ship,
          timestamp: Date.now(),
        });
      }

      // Update count
      this._updateShipCount();

      // Dispatch for timeline
      document.dispatchEvent(new CustomEvent('ships:updated', {
        detail: { count: this.ships.size, ships: Array.from(this.ships.values()).map(s => s.data) }
      }));

    } catch (err) {
      console.error('[ShipsLayer] REST fetch failed:', err);
    }
  }

  // ────────────────────────────────────────────────────────────
  //  Ship Management
  // ────────────────────────────────────────────────────────────

  _upsertShip(shipData) {
    const mmsi = shipData.mmsi;
    if (!mmsi) return;

    // Enforce max ships limit
    if (!this.ships.has(mmsi) && this.ships.size >= this.config.maxShips) {
      // Remove oldest ship
      let oldestMmsi = null;
      let oldestTime = Infinity;
      for (const [id, entry] of this.ships) {
        if (entry.lastUpdate < oldestTime) {
          oldestTime = entry.lastUpdate;
          oldestMmsi = id;
        }
      }
      if (oldestMmsi) this._removeShip(oldestMmsi);
    }

    const existing = this.ships.get(mmsi);
    const pos = this._lat2point(shipData.lat, shipData.lng, 0.012);

    if (existing) {
      // Update existing ship — set target position for interpolation
      existing.data = shipData;
      existing.targetPos = pos;
      existing.lastUpdate = Date.now();

      // Update heading
      if (shipData.heading != null && existing.mesh) {
        existing.mesh.userData.heading = shipData.heading;
        this._orientShipMesh(existing.mesh, shipData.heading, shipData.lat, shipData.lng);
      }

      // Update color if type changed
      const newColor = this._shipTypeColor(shipData.shipType);
      if (existing.mesh && existing.mesh.userData.typeColor !== newColor) {
        existing.mesh.material.color.setHex(parseInt(newColor.replace('#', ''), 16));
        existing.mesh.userData.typeColor = newColor;
      }
    } else {
      // Create new ship
      const mesh = this._createShipMesh(shipData);
      if (mesh) {
        mesh.position.copy(pos);
        this.group.add(mesh);

        this.ships.set(mmsi, {
          data: shipData,
          mesh,
          currentPos: pos.clone(),
          targetPos: pos.clone(),
          lastUpdate: Date.now(),
        });
      }
    }

    // Update count (throttled — only every 50 ships to avoid DOM thrash)
    if (this.ships.size % 50 === 0) {
      this._updateShipCount();
    }
  }

  _removeShip(mmsi) {
    const entry = this.ships.get(mmsi);
    if (!entry) return;

    if (entry.mesh) {
      this._disposeMesh(entry.mesh);
      this.group.remove(entry.mesh);
    }
    this.ships.delete(mmsi);

    if (this.followedShip === mmsi) {
      this.followedShip = null;
    }
  }

  _updateShipCount() {
    const countEl = document.getElementById('lt-ships-count');
    if (countEl) {
      countEl.textContent = this.ships.size > 0 ? this.ships.size.toLocaleString() : '—';
    }
  }

  _updateStatusIndicator() {
    // Could add a visual indicator for connection status
    // For now, just update the description
    const desc = this.layerToggle?.querySelector('.lt-desc');
    if (desc) {
      if (this.connectionStatus === 'connected') {
        desc.textContent = 'AIS WebSocket · live';
        desc.style.color = '#22c55e';
      } else if (this.connectionStatus === 'fallback') {
        desc.textContent = 'REST fallback · 2min';
        desc.style.color = '#fbbf24';
      } else {
        desc.textContent = 'AIS tracking · global';
        desc.style.color = '';
      }
    }
  }

  // ────────────────────────────────────────────────────────────
  //  Mesh Creation
  // ────────────────────────────────────────────────────────────

  _createShipMesh(ship) {
    if (typeof THREE === 'undefined') return null;

    const color = this._shipTypeColor(ship.shipType);
    const colorHex = parseInt(color.replace('#', ''), 16);

    // Create a small cone/triangle pointing forward (heading direction)
    const geometry = new THREE.ConeGeometry(0.5 * this.config.dotScale, 1.5 * this.config.dotScale, 4);
    geometry.rotateX(Math.PI / 2);  // Orient cone forward (along Z)

    const material = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.8,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.typeColor = color;
    mesh.userData.shipMmsi = ship.mmsi;
    mesh.userData.shipData = ship;
    mesh.userData.heading = ship.heading || 0;

    // Orient
    this._orientShipMesh(mesh, ship.heading || 0, ship.lat, ship.lng);

    // Add small glow for highlighted/followed ships (initially hidden)
    const glowGeo = new THREE.SphereGeometry(this.config.dotScale * 1.5, 8, 8);
    const glowMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    mesh.add(glow);
    mesh.userData.glow = glow;

    return mesh;
  }

  _orientShipMesh(mesh, heading, lat, lng) {
    // Orient the ship to face its heading direction
    // The mesh is positioned on the globe surface, so we need to:
    // 1. Face outward from globe center
    // 2. Rotate by heading around the surface normal

    const pos = mesh.position;
    const normal = pos.clone().normalize();

    // Create a basis where up = normal (away from globe center)
    // and forward = heading direction
    const up = normal;
    const north = new THREE.Vector3(0, 1, 0);
    const east = new THREE.Vector3().crossVectors(up, north).normalize();
    const forward = new THREE.Vector3().crossVectors(east, up).normalize();

    // Heading is clockwise from north (0° = north, 90° = east)
    const headingRad = (heading || 0) * Math.PI / 180;
    const forwardRotated = forward.clone().multiplyScalar(Math.cos(headingRad))
      .add(east.clone().multiplyScalar(Math.sin(headingRad)));

    // Build rotation matrix
    const matrix = new THREE.Matrix4();
    matrix.lookAt(new THREE.Vector3(0, 0, 0), forwardRotated.negate(), up);
    mesh.quaternion.setFromRotationMatrix(matrix);
  }

  // ────────────────────────────────────────────────────────────
  //  Animation Loop — Smooth Interpolation
  // ────────────────────────────────────────────────────────────

  _animate() {
    if (!this.enabled) return;

    const lerpFactor = this.config.interpolateSpeed;
    const now = Date.now();

    // Remove ships not updated in 10 minutes (stale)
    const staleThreshold = 10 * 60 * 1000;
    const toRemove = [];
    for (const [mmsi, entry] of this.ships) {
      if (now - entry.lastUpdate > staleThreshold) {
        toRemove.push(mmsi);
      }
    }
    for (const mmsi of toRemove) {
      this._removeShip(mmsi);
    }

    // Interpolate positions
    for (const [mmsi, entry] of this.ships) {
      if (!entry.mesh || !entry.targetPos) continue;

      // Lerp current position toward target
      entry.mesh.position.lerp(entry.targetPos, lerpFactor);

      // Update currentPos tracking
      entry.currentPos.copy(entry.mesh.position);

      // Pulse glow if followed
      if (this.followedShip === mmsi && entry.mesh.userData.glow) {
        const pulse = 0.3 + 0.2 * Math.sin(now * 0.003);
        entry.mesh.userData.glow.material.opacity = pulse;
      }
    }

    // If following a ship, move camera to track it
    if (this.followedShip && this.config.globe) {
      const followed = this.ships.get(this.followedShip);
      if (followed && followed.mesh) {
        const pos = followed.mesh.position;
        // Nudge globe camera toward ship position (globe.center)
        if (this.config.globe.pointOfView) {
          const currentPov = this.config.globe.pointOfView();
          // Only update if the globe supports it
          // This gently moves the camera; actual implementation depends on globe.gl API
        }
      }
    }

    this.animationFrame = requestAnimationFrame(() => this._animate());
  }

  // ────────────────────────────────────────────────────────────
  //  Interaction
  // ────────────────────────────────────────────────────────────

  _onMouseMove(event) {
    if (!this.enabled || this.ships.size === 0) return;
    if (typeof THREE === 'undefined') return;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2(
      (event.clientX / window.innerWidth) * 2 - 1,
      -(event.clientY / window.innerHeight) * 2 + 1
    );

    const camera = this.config.globe?.camera || window.__globeCamera;
    if (!camera) return;

    raycaster.setFromCamera(mouse, camera);

    const meshes = Array.from(this.ships.values()).map(e => e.mesh).filter(Boolean);
    const intersects = raycaster.intersectObjects(meshes, false);

    if (intersects.length > 0) {
      const hit = intersects[0].object;
      const shipData = hit.userData.shipData;
      if (shipData) {
        this._showTooltip(shipData, event.clientX, event.clientY);
        this.hoveredShip = shipData;
        document.body.style.cursor = 'pointer';
        return;
      }
    }

    this._hideTooltip();
    this.hoveredShip = null;
    document.body.style.cursor = '';
  }

  _onClick(event) {
    if (!this.enabled || !this.hoveredShip) return;

    const mmsi = this.hoveredShip.mmsi;

    if (this.followedShip === mmsi) {
      // Unfollow
      this.followedShip = null;
    } else {
      // Follow new ship
      this.followedShip = mmsi;

      // Clear all glows, then highlight followed ship
      for (const [id, entry] of this.ships) {
        if (entry.mesh?.userData.glow) {
          entry.mesh.userData.glow.material.opacity = 0;
        }
      }
    }

    // Update tooltip
    this._showTooltip(this.hoveredShip, event.clientX, event.clientY);

    document.dispatchEvent(new CustomEvent('ships:follow', {
      detail: { mmsi, ship: this.ships.get(mmsi)?.data }
    }));
  }

  // ────────────────────────────────────────────────────────────
  //  Enable / Disable
  // ────────────────────────────────────────────────────────────

  enable() {
    this.enabled = true;
    if (this.group) this.group.visible = true;

    // Add group to scene
    if (this.config.globe?.scene && this.group) {
      this.config.globe.scene.add(this.group);
    } else if (window.__globeScene && this.group) {
      window.__globeScene.add(this.group);
    }

    // Start data source
    if (this.config.useWebSocket && this.config.aisApiKey) {
      this._connectWebSocket();
    } else {
      this._startRestFallback();
    }

    // Start animation loop
    this._animate();

    // Bind interaction events
    this._boundMouseMove = this._onMouseMove.bind(this);
    this._boundClick = this._onClick.bind(this);
    document.addEventListener('mousemove', this._boundMouseMove);
    document.addEventListener('click', this._boundClick);

    document.dispatchEvent(new CustomEvent('ships:enabled'));
  }

  disable() {
    this.enabled = false;
    if (this.group) this.group.visible = false;

    // Stop data sources
    this._disconnectWebSocket();
    this._stopRestFallback();

    // Stop animation
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    // Unbind events
    if (this._boundMouseMove) {
      document.removeEventListener('mousemove', this._boundMouseMove);
      this._boundMouseMove = null;
    }
    if (this._boundClick) {
      document.removeEventListener('click', this._boundClick);
      this._boundClick = null;
    }

    this._hideTooltip();
    this.hoveredShip = null;
    this.followedShip = null;
    document.body.style.cursor = '';

    document.dispatchEvent(new CustomEvent('ships:disabled'));
  }

  // ────────────────────────────────────────────────────────────
  //  Timeline Integration
  // ────────────────────────────────────────────────────────────

  /**
   * Get current ship data for timeline snapshot.
   */
  getSnapshotData() {
    return Array.from(this.ships.values()).map(e => e.data);
  }

  /**
   * Render ships from a timeline snapshot (rewind mode).
   */
  renderSnapshot(ships) {
    if (!this.enabled) return;
    // Clear and re-render from snapshot
    this._clearAllShips();
    for (const ship of (ships || [])) {
      this._upsertShip({ ...ship, timestamp: Date.now() });
    }
    this._updateShipCount();
  }

  _clearAllShips() {
    for (const [mmsi] of this.ships) {
      this._removeShip(mmsi);
    }
  }

  _disposeMesh(mesh) {
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material) mesh.material.dispose();
    if (mesh.userData.glow) {
      mesh.userData.glow.geometry?.dispose();
      mesh.userData.glow.material?.dispose();
    }
  }

  /**
   * Destroy and clean up.
   */
  destroy() {
    this.disable();
    this._clearAllShips();
    if (this.tooltip && this.tooltip.parentNode) {
      this.tooltip.parentNode.removeChild(this.tooltip);
    }
    if (this.layerToggle && this.layerToggle.parentNode) {
      this.layerToggle.parentNode.removeChild(this.layerToggle);
    }
  }
}

// Export
if (typeof window !== 'undefined') {
  window.ShipsLayer = ShipsLayer;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ShipsLayer;
}