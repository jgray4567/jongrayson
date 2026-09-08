/* ═══════════════════════════════════════════════════════════════════
   EXPLORER — a scaled-down exploration window
   CesiumJS globe: photorealistic 3D tiles + search + orbit pad
   Orbit pad = combined POV control: drag horizontally to spin the
   camera around what you're looking at, vertically to tilt (pitch).
   Built on Cesium's canonical orbit pattern (lookAtTransform +
   HeadingPitchRange), same math AVOID v2's fly-through uses.
   ═══════════════════════════════════════════════════════════════════ */
(() => {
  "use strict";

  /* ── Constants ─────────────────────────────────────────────────── */
  const CESIUM_ION_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6ImtkdUlfbGxCUW83Z2dWYloiLCJqdGkiOiJkYzU5NzlmYi02Yjc1LTQ5ODktOTRiZi00Y2U2MjY4ZDAyMTgiLCJpZCI6NDY4MTA4LCJpc3MiOiJodHRwczovL2FwaS5jZXNpdW0uY29tIiwiYXVkIjoidW5kZWZpbmVkX2RlZmF1bHQiLCJpYXQiOjE3ODY3MzQ4NjB9.jiXoqooSwIzUz6CeI8Zxsmsb-idHU8UOXjZy89vctP0";
  const GOOGLE_MAPS_API_KEY = "AIzaSyDFKTaRsE3mCxj0vcJn6ny11aNVki88ipQ";
  const IS_MOBILE = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const SSE_DESKTOP = 2;
  const SSE_MOBILE = 16;

  /* ── State ─────────────────────────────────────────────────────── */
  let viewer = null;

  /* ── Module 1: Cesium Init ──────────────────────────────────────── */
  async function initCesium() {
    if (typeof Cesium === "undefined") {
      console.error("[EXPLORER] CesiumJS not loaded");
      const loader = document.getElementById("loading-overlay");
      if (loader) loader.querySelector(".loader-text").textContent = "Failed to load CesiumJS from CDN";
      return;
    }

    try {
      Cesium.Ion.defaultAccessToken = CESIUM_ION_TOKEN;
      Cesium.GoogleMaps.defaultApiKey = GOOGLE_MAPS_API_KEY;

      // NaturalEarthII base — loads instantly, never blocks
      const naturalEarth = Cesium.ImageryLayer.fromProviderAsync(
        Cesium.TileMapServiceImageryProvider.fromUrl(
          Cesium.buildModuleUrl("Assets/Textures/NaturalEarthII")
        )
      );

      viewer = new Cesium.Viewer("cesium-container", {
        timeline: false,
        animation: false,
        baseLayerPicker: false,
        geocoder: false,
        homeButton: false,
        sceneModePicker: false,
        navigationHelpButton: false,
        fullscreenButton: false,
        infoBox: false,
        selectionIndicator: false,
        baseLayer: naturalEarth,
      });

      // Start at global overview
      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(-98.5, 39.5, 5000000),
        orientation: { heading: 0, pitch: Cesium.Math.toRadians(-90), roll: 0 },
      });

      // Altitude floor (approximates v2's clamp)
      viewer.scene.screenSpaceCameraController.minimumZoomDistance = IS_MOBILE ? 160 : 45;

      setupUI();
      setupReadouts();

      // Hide loader
      const loader = document.getElementById("loading-overlay");
      if (loader) loader.classList.add("hidden");
      console.log("[EXPLORER] Globe initialized.");

      // Sharp satellite imagery swap (non-blocking)
      try {
        const ionImagery = await Cesium.IonImageryProvider.fromAssetId(2);
        const gLayer = viewer.imageryLayers.addImageryProvider(ionImagery);
        if (gLayer) {
          viewer.imageryLayers.raiseToTop(gLayer);
          setTimeout(function () {
            const oldBase = viewer.imageryLayers.get(0);
            if (oldBase && oldBase !== gLayer) viewer.imageryLayers.remove(oldBase);
          }, 3000);
          console.log("[EXPLORER] Satellite imagery swapped in.");
        }
      } catch (imgErr) {
        console.warn("[EXPLORER] Ion imagery swap failed:", imgErr.message);
        try {
          const googleImagery = new Cesium.GoogleMapsImageryProvider({
            mapType: Cesium.GoogleMapsMapType.SATELLITE
          });
          const gLayer2 = viewer.imageryLayers.addImageryProvider(googleImagery);
          if (gLayer2) {
            viewer.imageryLayers.raiseToTop(gLayer2);
            setTimeout(function () {
              const oldBase2 = viewer.imageryLayers.get(0);
              if (oldBase2 && oldBase2 !== gLayer2) viewer.imageryLayers.remove(oldBase2);
            }, 3000);
            console.log("[EXPLORER] Google Maps satellite imagery in (fallback).");
          }
        } catch (gErr2) {
          console.warn("[EXPLORER] Imagery fallback failed too:", gErr2.message);
        }
      }

      // Cesium World Terrain
      try {
        const terrain = await Cesium.CesiumTerrainProvider.fromIonAssetId(1);
        viewer.terrainProvider = terrain;
        console.log("[EXPLORER] Cesium World Terrain loaded.");
      } catch (terrErr) {
        console.warn("[EXPLORER] World Terrain failed:", terrErr.message);
      }

      // Google 3D Tiles
      try {
        const tileset = await Promise.race([
          Cesium.createGooglePhotorealistic3DTileset(),
          new Promise((_, reject) => setTimeout(() => reject(new Error("3D Tiles timeout")), 15000)),
        ]);
        tileset.maximumScreenSpaceError = IS_MOBILE ? SSE_MOBILE : SSE_DESKTOP;
        tileset.maximumSimultaneousRequests = IS_MOBILE ? 3 : 20;
        try {
          tileset.style = new Cesium.Cesium3DTileStyle({
            show: true,
            pointSize: 0,
            label: { show: false }
          });
        } catch (e) { console.warn("[EXPLORER] Could not suppress tile labels:", e); }
        viewer.scene.primitives.add(tileset);
        console.log("[EXPLORER] 3D Tiles loaded — SSE=" + (IS_MOBILE ? SSE_MOBILE : SSE_DESKTOP));
      } catch (gErr) {
        console.warn("[EXPLORER] Google 3D Tiles skipped:", gErr.message || gErr);
      }
    } catch (err) {
      console.error("[EXPLORER] Init failed:", err);
      const loader = document.getElementById("loading-overlay");
      if (loader) loader.querySelector(".loader-text").textContent = "Initialization failed";
    }
  }

  /* ── Module 2: Search (v2 behavior, URLSearchParams build) ──────── */
  function doSearch() {
    const searchInput = document.getElementById("location-search");
    if (!searchInput || !viewer) return;
    const query = searchInput.value.trim();
    if (!query) return;

    // Coordinates: "lat, lon"
    const coordMatch = query.match(/^(-?[\d.]+),\s*(-?[\d.]+)$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lon = parseFloat(coordMatch[2]);
      // Center the target mid-screen: place the camera back along the
      // view ray (heading N, tilt down) so the searched point lands dead-center,
      // not below the bottom edge. Same altitude as the old over-the-point flight.
      const tiltDeg = 45;
      viewer.camera.flyToBoundingSphere(
        new Cesium.BoundingSphere(Cesium.Cartesian3.fromDegrees(lon, lat), 1),
        {
          offset: new Cesium.HeadingPitchRange(
            0,
            Cesium.Math.toRadians(-tiltDeg),
            5000 / Math.sin(Cesium.Math.toRadians(tiltDeg))
          ),
          duration: 2.0,
        }
      );
      return;
    }

    // Google Geocoding API
    const geocodeBase = "https://maps.googleapis.com/maps/api/geocode/json";
    const params = new URLSearchParams({ address: query, key: GOOGLE_MAPS_API_KEY });

    fetch(geocodeBase + "?" + params.toString())
      .then(r => r.json())
      .then(data => {
        if (data.status === "OK" && data.results.length > 0) {
          const loc = data.results[0].geometry.location;
          const vp = data.results[0].geometry.viewport;
          const widthM = Cesium.Math.toRadians(vp.northeast.lng - vp.southwest.lng) * 6371000;
          const altM = Math.max(widthM * 0.8, 300);
          // Center the target mid-screen: camera back along the view ray
          // (heading N, 35° down); range = altM / sin(tilt) preserves the
          // original arrival altitude, but now the city sits at screen center.
          const tiltDeg = 35;
          viewer.camera.flyToBoundingSphere(
            new Cesium.BoundingSphere(Cesium.Cartesian3.fromDegrees(loc.lng, loc.lat), 1),
            {
              offset: new Cesium.HeadingPitchRange(
                0,
                Cesium.Math.toRadians(-tiltDeg),
                altM / Math.sin(Cesium.Math.toRadians(tiltDeg))
              ),
              duration: 2.0,
            }
          );
          console.log("[EXPLORER] Flew to:", data.results[0].formatted_address, "at", Math.round(altM) + "m");
        } else {
          alert("Location not found: " + query);
        }
      })
      .catch(err => console.warn("[EXPLORER] Geocode error:", err));
  }

  /* ── Module 3: Orbit Pad (combined POV + flight angle) ───────────── */
  const pad = {
    active: false,
    target: null,          // locked orbit center (Cartesian3)
    range: 0,              // camera distance to target at lock time
    heading: 0,            // degrees
    pitch: 0,              // degrees, clamped [-90, 0]
    lastX: 0, lastY: 0,
    vel: 0,                // deg per frame, for inertia
    raf: null,
    thumbDX: 0, thumbDY: 0,
  };
  const HEADING_SENS = 1.0;   // deg per px
  const PITCH_SENS = 0.4;     // deg per px
  const INERTIA_DECAY = 0.94;

  function clampPitchDeg(p) { return Math.max(-90, Math.min(0, p)); }
  function normHeadingDeg(h) { return ((h % 360) + 360) % 360; }

  function pickOrbitTarget() {
    const canvas = viewer.scene.canvas;
    const center = new Cesium.Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2);
    let target = null;
    if (viewer.scene.pickPositionSupported) {
      try { target = viewer.scene.pickPosition(center); } catch (e) { /* off-globe */ }
    }
    if (!Cesium.defined(target)) {
      target = viewer.camera.pickEllipsoid(center, viewer.scene.globe.ellipsoid);
    }
    return Cesium.defined(target) ? target : null;
  }

  function applyOrbit() {
    if (!pad.target) return;
    const transform = Cesium.Transforms.eastNorthUpToFixedFrame(pad.target);
    viewer.camera.lookAtTransform(transform, new Cesium.HeadingPitchRange(
      Cesium.Math.toRadians(pad.heading),
      Cesium.Math.toRadians(pad.pitch),
      pad.range
    ));
    updateReadouts();
  }

  function releaseOrbit() {
    if (viewer && viewer.camera) {
      viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
    }
    pad.target = null;
    pad.active = false;
    resetThumb();
  }

  function stopInertia() {
    if (pad.raf) { cancelAnimationFrame(pad.raf); pad.raf = null; }
    pad.vel = 0;
  }

  function startInertia() {
    stopInertia();
    const step = function () {
      if (Math.abs(pad.vel) < 0.02 || !pad.target) { releaseOrbit(); return; }
      pad.heading = normHeadingDeg(pad.heading + pad.vel);
      pad.vel *= INERTIA_DECAY;
      applyOrbit();
      pad.raf = requestAnimationFrame(step);
    };
    pad.raf = requestAnimationFrame(step);
  }

  function padPointerDown(e) {
    if (!viewer) return;
    stopInertia();
    const t = pickOrbitTarget();
    if (!t) return;
    e.preventDefault();
    pad.target = t;
    pad.range = Cesium.Cartesian3.distance(viewer.camera.position, t);
    pad.heading = normHeadingDeg(Cesium.Math.toDegrees(viewer.camera.heading));
    pad.pitch = clampPitchDeg(Cesium.Math.toDegrees(viewer.camera.pitch));
    pad.lastX = e.clientX;
    pad.lastY = e.clientY;
    pad.active = true;
    pad.thumbDX = 0; pad.thumbDY = 0;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ }
    updateThumb();
    updateReadouts();
  }

  function padPointerMove(e) {
    if (!pad.active) return;
    e.preventDefault();
    const dx = e.clientX - pad.lastX;
    const dy = e.clientY - pad.lastY;
    pad.lastX = e.clientX;
    pad.lastY = e.clientY;
    pad.heading = normHeadingDeg(pad.heading + dx * HEADING_SENS);
    pad.pitch = clampPitchDeg(pad.pitch - dy * PITCH_SENS);
    pad.vel = dx * HEADING_SENS;
    pad.thumbDX = Math.max(-28, Math.min(28, pad.thumbDX + dx));
    pad.thumbDY = Math.max(-28, Math.min(28, pad.thumbDY + dy));
    updateThumb();
    applyOrbit();
  }

  function padPointerUp(e) {
    if (!pad.active) return;
    pad.active = false;
    if (Math.abs(pad.vel) > 1.2) startInertia();
    else releaseOrbit();
  }

  /* ── Module 4: Readouts + thumb ─────────────────────────────────── */
  function compassLabel(h) {
    const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    return dirs[Math.round(h / 45) % 8];
  }

  function updateReadouts() {
    const hEl = document.getElementById("readout-heading");
    const pEl = document.getElementById("readout-pitch");
    if (!hEl || !pEl) return;
    let h, p;
    if (pad.target) {
      h = pad.heading;
      p = pad.pitch;
    } else if (viewer) {
      h = normHeadingDeg(Cesium.Math.toDegrees(viewer.camera.heading));
      p = clampPitchDeg(Cesium.Math.toDegrees(viewer.camera.pitch));
    } else return;
    hEl.textContent = compassLabel(h) + " " + Math.round(h) + "°";
    let tier;
    if (p <= -80) tier = "top-down";
    else if (p <= -45) tier = "high angle";
    else if (p <= -15) tier = "low angle";
    else tier = "flight view";
    pEl.textContent = Math.round(p) + "° " + tier;
  }

  function updateThumb() {
    const thumb = document.getElementById("pad-thumb");
    if (thumb) thumb.style.transform = "translate(" + pad.thumbDX + "px, " + pad.thumbDY + "px)";
  }

  function resetThumb() {
    pad.thumbDX = 0; pad.thumbDY = 0;
    updateThumb();
  }

  function setupReadouts() {
    if (!viewer) return;
    viewer.camera.changed.addEventListener(updateReadouts);
    // Any direct map interaction kills inertia (avoids range fights)
    const kill = function () { if (!pad.active) stopInertia(); };
    viewer.scene.canvas.addEventListener("wheel", kill, { passive: true });
    viewer.scene.canvas.addEventListener("pointerdown", kill, { passive: true });
    viewer.scene.canvas.addEventListener("touchstart", kill, { passive: true });
  }

  /* ── Module 5: UI wiring ────────────────────────────────────────── */
  function setupUI() {
    const searchBtn = document.getElementById("search-btn");
    const searchInput = document.getElementById("location-search");
    if (searchBtn) searchBtn.addEventListener("click", doSearch);
    if (searchInput) {
      searchInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") doSearch();
      });
    }

    const padEl = document.getElementById("orbit-pad");
    if (padEl) {
      padEl.addEventListener("pointerdown", padPointerDown);
      padEl.addEventListener("pointermove", padPointerMove);
      padEl.addEventListener("pointerup", padPointerUp);
      padEl.addEventListener("pointercancel", padPointerUp);
    }
  }

  /* ── Boot ────────────────────────────────────────────────────────── */
  document.addEventListener("DOMContentLoaded", initCesium);
})();