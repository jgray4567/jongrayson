/**
 * FiresLayer — NASA FIRMS Global Fire Detection for Intel Globe v2
 *
 * Fetches active fire data from NASA VIIRS satellite via PHP proxy,
 * renders glowing orange/red dots on the Three.js globe.
 *
 * Features:
 *   - Size by Fire Radiative Power (FRP)
 *   - Color by confidence level
 *   - Pulsing animation for high-confidence fires
 *   - Hover tooltips with fire details
 *   - Layer toggle with live count
 *   - Auto-refresh every 30 minutes
 *
 * Usage:
 *   const fires = new FiresLayer({ globe: myGlobe, apiBase: '/intel/api' });
 *   fires.init();
 *   fires.enable();
 *
 * Dependencies: Three.js, extended-layers.css
 */

class FiresLayer {
  constructor(options = {}) {
    this.config = {
      globe: options.globe || null,
      apiBase: options.apiBase || '/intel/api',
      refreshIntervalMs: 30 * 60 * 1000,  // 30 minutes
      maxDots: options.maxDots || 2000,
      minFRP: options.minFRP || 0,
      dotScale: options.dotScale || 0.5,
      pulseSpeed: options.pulseSpeed || 0.003,
    };

    // State
    this.enabled = false;
    this.fires = [];
    this.meshes = new Map();   // fireId → { mesh, data, pulsePhase }
    this.group = null;         // THREE.Group containing all fire meshes
    this.refreshInterval = null;
    this.animationFrame = null;
    this.hoveredFire = null;

    // UI
    this.layerToggle = null;
    this.tooltip = null;

    // Globe helper functions (from globe.gl)
    this._lat2point = null;
    this._point2lat = null;
  }

  // ────────────────────────────────────────────────────────────
  //  Initialization
  // ────────────────────────────────────────────────────────────

  init() {
    // Create Three.js group
    if (typeof THREE !== 'undefined') {
      this.group = new THREE.Group();
      this.group.name = 'fires-layer';
      this.group.visible = false;
    }

    // Create tooltip
    this._createTooltip();

    // Create layer toggle entry
    this._createLayerToggle();

    // Get coordinate conversion functions from globe
    if (this.config.globe) {
      const globe = this.config.globe;
      // globe.gl uses getCoords for lat/lng → 3D position
      if (globe.getCoords) {
        this._lat2point = (lat, lng, alt = 0.01) => {
          const coords = globe.getCoords(lat, lng, alt);
          return { x: coords.x, y: coords.y, z: coords.z };
        };
      } else if (globe.toGeoCoords) {
        this._lat2point = (lat, lng, alt = 0.01) => globe.toGeoCoords(lat, lng, alt);
      }
    }

    // Fallback coordinate conversion (spherical to cartesian)
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

    // Find or create the "Live Feeds" section
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
      <input type="checkbox" class="lt-checkbox" id="lt-fires">
      <div class="lt-icon" style="color: #ff6b35;">🔥</div>
      <div class="lt-info">
        <div class="lt-name">Active Fires</div>
        <div class="lt-desc">NASA VIIRS · global 24h</div>
      </div>
      <div class="lt-count" id="lt-fires-count">—</div>
    `;

    layersPanel.appendChild(toggle);

    this.layerToggle = toggle;
    const checkbox = toggle.querySelector('#lt-fires');
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        this.enable();
      } else {
        this.disable();
      }
    });
  }

  // ────────────────────────────────────────────────────────────
  //  Tooltip
  // ────────────────────────────────────────────────────────────

  _createTooltip() {
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'fire-tooltip glass';
    this.tooltip.style.display = 'none';
    document.body.appendChild(this.tooltip);
  }

  _showTooltip(fire, x, y) {
    if (!this.tooltip) return;

    const confLabel = this._confidenceLabel(fire.confidence);
    const acqTime = fire.acq_timestamp || `${fire.acq_date} ${fire.acq_time}`;

    this.tooltip.innerHTML = `
      <div class="ft-header">
        <span class="ft-icon">🔥</span>
        <span class="ft-title">Active Fire Detection</span>
      </div>
      <div class="ft-row"><span class="ft-lbl">Brightness</span><span class="ft-val">${fire.brightness.toFixed(1)} K</span></div>
      <div class="ft-row"><span class="ft-lbl">Confidence</span><span class="ft-val ft-conf-${confLabel.toLowerCase()}">${confLabel}</span></div>
      <div class="ft-row"><span class="ft-lbl">FRP</span><span class="ft-val">${fire.frp.toFixed(1)} MW</span></div>
      <div class="ft-row"><span class="ft-lbl">Satellite</span><span class="ft-val">${fire.satellite || 'N/A'}</span></div>
      <div class="ft-row"><span class="ft-lbl">Acquired</span><span class="ft-val">${acqTime || 'N/A'}</span></div>
      <div class="ft-row"><span class="ft-lbl">Position</span><span class="ft-val">${fire.lat.toFixed(3)}°, ${fire.lng.toFixed(3)}°</span></div>
    `;

    this.tooltip.style.display = 'block';
    this.tooltip.style.left = `${x + 14}px`;
    this.tooltip.style.top = `${y + 14}px`;
  }

  _hideTooltip() {
    if (this.tooltip) this.tooltip.style.display = 'none';
  }

  _confidenceLabel(conf) {
    const c = (conf || '').toString().toLowerCase();
    if (c === 'h' || c === 'high') return 'High';
    if (c === 'n' || c === 'nominal' || c === 'medium') return 'Nominal';
    if (c === 'l' || c === 'low') return 'Low';
    return conf || 'Unknown';
  }

  // ────────────────────────────────────────────────────────────
  //  Data Fetching
  // ────────────────────────────────────────────────────────────

  async fetchData() {
    const url = `${this.config.apiBase}/extended-feeds.php?source=fires`;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return data.items || data.fires || [];
    } catch (err) {
      console.error('[FiresLayer] Fetch failed:', err);
      return [];
    }
  }

  async refresh() {
    const fires = await this.fetchData();
    this.fires = fires;

    // Update count in layer toggle
    const countEl = document.getElementById('lt-fires-count');
    if (countEl) {
      countEl.textContent = fires.length > 0 ? fires.length.toLocaleString() : '—';
    }

    if (this.enabled) {
      this._renderFires(fires);
    }

    // Dispatch event for timeline engine
    document.dispatchEvent(new CustomEvent('fires:updated', { detail: { fires, count: fires.length } }));
  }

  // ────────────────────────────────────────────────────────────
  //  Rendering
  // ────────────────────────────────────────────────────────────

  _renderFires(fires) {
    if (!this.group || typeof THREE === 'undefined') return;

    // Clear existing meshes
    this._clearMeshes();

    // Sort by FRP descending — render most intense first
    const sorted = [...fires]
      .filter(f => f.frp >= this.config.minFRP)
      .sort((a, b) => b.frp - a.frp)
      .slice(0, this.config.maxDots);

    for (let i = 0; i < sorted.length; i++) {
      const fire = sorted[i];
      const mesh = this._createFireMesh(fire);
      if (mesh) {
        this.group.add(mesh);
        const fireId = `fire-${i}`;
        mesh.userData.fireId = fireId;
        mesh.userData.fireData = fire;
        this.meshes.set(fireId, {
          mesh,
          data: fire,
          pulsePhase: Math.random() * Math.PI * 2,
          isHighConf: this._isHighConfidence(fire.confidence),
        });
      }
    }
  }

  _createFireMesh(fire) {
    const { lat, lng, frp, confidence } = fire;

    // Size based on FRP (fire radiative power in MW)
    // Typical FRP: 1-300 MW. Map to 0.3-2.5 units.
    const sizeFactor = Math.min(1, Math.log(frp + 1) / Math.log(300));
    const size = 0.3 + sizeFactor * 2.2;

    // Color based on confidence
    const conf = (confidence || '').toString().toLowerCase();
    let color;
    let emissiveIntensity;

    if (conf === 'h' || conf === 'high') {
      color = 0xff2200;       // Bright red
      emissiveIntensity = 1.2;
    } else if (conf === 'n' || conf === 'nominal' || conf === 'medium') {
      color = 0xff6b35;       // Orange
      emissiveIntensity = 0.8;
    } else {
      color = 0xcc5500;       // Dim orange
      emissiveIntensity = 0.4;
    }

    // Create a small sphere with glow material
    const geometry = new THREE.SphereGeometry(size * this.config.dotScale, 8, 8);
    const material = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.85,
    });

    const mesh = new THREE.Mesh(geometry, material);

    // Position on globe
    const pos = this._lat2point(lat, lng, 0.015);
    mesh.position.set(pos.x, pos.y, pos.z);

    // Add glow halo for high-confidence fires
    if (conf === 'h' || conf === 'high') {
      const haloGeo = new THREE.SphereGeometry(size * this.config.dotScale * 2.2, 8, 8);
      const haloMat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.15,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const halo = new THREE.Mesh(haloGeo, haloMat);
      mesh.add(halo);
      mesh.userData.halo = halo;
    }

    // Orient to face outward from globe center
    mesh.lookAt(0, 0, 0);
    mesh.rotateX(Math.PI / 2);

    return mesh;
  }

  _isHighConfidence(conf) {
    const c = (conf || '').toString().toLowerCase();
    return c === 'h' || c === 'high';
  }

  _clearMeshes() {
    if (!this.group) return;
    while (this.group.children.length > 0) {
      const child = this.group.children[0];
      this._disposeMesh(child);
      this.group.remove(child);
    }
    this.meshes.clear();
  }

  _disposeMesh(mesh) {
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material) mesh.material.dispose();
    if (mesh.userData.halo) {
      mesh.userData.halo.geometry?.dispose();
      mesh.userData.halo.material?.dispose();
    }
    // Dispose children recursively
    mesh.children.forEach(child => this._disposeMesh(child));
  }

  // ────────────────────────────────────────────────────────────
  //  Animation Loop
  // ────────────────────────────────────────────────────────────

  _animate() {
    if (!this.enabled) return;

    const time = performance.now();

    for (const [id, entry] of this.meshes) {
      const { mesh, pulsePhase, isHighConf } = entry;

      if (isHighConf) {
        // Pulsing animation for high-confidence fires
        const pulse = 0.7 + 0.3 * Math.sin(time * this.config.pulseSpeed + pulsePhase);
        mesh.material.opacity = 0.6 + pulse * 0.35;

        if (mesh.userData.halo) {
          mesh.userData.halo.material.opacity = 0.08 + pulse * 0.12;
          const scale = 1 + pulse * 0.3;
          mesh.userData.halo.scale.setScalar(scale);
        }
      } else {
        // Gentle flicker for other fires
        const flicker = 0.75 + 0.15 * Math.sin(time * 0.001 + pulsePhase);
        mesh.material.opacity = flicker;
      }
    }

    this.animationFrame = requestAnimationFrame(() => this._animate());
  }

  // ────────────────────────────────────────────────────────────
  //  Hover / Interaction
  // ────────────────────────────────────────────────────────────

  _onMouseMove(event) {
    if (!this.enabled || this.meshes.size === 0) return;

    // Use raycaster if globe is available
    if (!this.config.globe || typeof THREE === 'undefined') return;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2(
      (event.clientX / window.innerWidth) * 2 - 1,
      -(event.clientY / window.innerHeight) * 2 + 1
    );

    raycaster.setFromCamera(mouse, this.config.globe.camera || window.__globeCamera);

    const meshes = Array.from(this.meshes.values()).map(e => e.mesh);
    const intersects = raycaster.intersectObjects(meshes, true);

    if (intersects.length > 0) {
      const hit = intersects[0].object;
      const fireData = hit.userData.fireData || hit.parent?.userData?.fireData;
      if (fireData) {
        this._showTooltip(fireData, event.clientX, event.clientY);
        this.hoveredFire = fireData;
        document.body.style.cursor = 'pointer';
        return;
      }
    }

    this._hideTooltip();
    this.hoveredFire = null;
    document.body.style.cursor = '';
  }

  // ────────────────────────────────────────────────────────────
  //  Enable / Disable
  // ────────────────────────────────────────────────────────────

  enable() {
    this.enabled = true;
    if (this.group) this.group.visible = true;

    // Add group to globe scene
    if (this.config.globe?.scene && this.group) {
      this.config.globe.scene.add(this.group);
    } else if (window.__globeScene && this.group) {
      window.__globeScene.add(this.group);
    }

    // Initial fetch and render
    this.refresh();

    // Start auto-refresh
    this.refreshInterval = setInterval(() => this.refresh(), this.config.refreshIntervalMs);

    // Start animation loop
    this._animate();

    // Bind hover events
    document.addEventListener('mousemove', this._boundMouseMove = this._onMouseMove.bind(this));

    // Dispatch event
    document.dispatchEvent(new CustomEvent('fires:enabled'));
  }

  disable() {
    this.enabled = false;
    if (this.group) this.group.visible = false;

    // Stop refresh
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }

    // Stop animation
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    // Unbind hover
    if (this._boundMouseMove) {
      document.removeEventListener('mousemove', this._boundMouseMove);
      this._boundMouseMove = null;
    }

    this._hideTooltip();
    document.body.style.cursor = '';

    // Dispatch event
    document.dispatchEvent(new CustomEvent('fires:disabled'));
  }

  // ────────────────────────────────────────────────────────────
  //  Timeline Integration
  // ────────────────────────────────────────────────────────────

  /**
   * Get current fire data for timeline snapshot.
   */
  getSnapshotData() {
    return this.fires;
  }

  /**
   * Render fires from a timeline snapshot (rewind mode).
   */
  renderSnapshot(fires) {
    if (this.enabled) {
      this._renderFires(fires || []);
    }
  }

  /**
   * Destroy and clean up.
   */
  destroy() {
    this.disable();
    this._clearMeshes();
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
  window.FiresLayer = FiresLayer;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FiresLayer;
}