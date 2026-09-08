/* ═══════════════════════════════════════════════════════════════════
   PGH CRIME INTEL — Pittsburgh crime intelligence on a 3D-tile globe
   Base: Explorer (CesiumJS + Google Photorealistic 3D Tiles)
   Overlays: incident points by type, police zone indicators,
   historical-density hot zones, live filtering, incident drawer.
   City-agnostic shell: swap the data/*.js set + this file's CONFIG.
   ═══════════════════════════════════════════════════════════════════ */
(() => {
  "use strict";

  /* ── Config ──────────────────────────────────────────────────────── */
  const CESIUM_ION_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6ImtkdUlfbGxCUW83Z2dWYloiLCJqdGkiOiJkYzU5NzlmYi02Yjc1LTQ5ODktOTRiZi00Y2U2MjY4ZDAyMTgiLCJpZCI6NDY4MTA4LCJpc3MiOiJodHRwczovL2FwaS5jZXNpdW0uY29tIiwiYXVkIjoidW5kZWZpbmVkX2RlZmF1bHQiLCJpYXQiOjE3ODY3MzQ4NjB9.jiXoqooSwIzUz6CeI8Zxsmsb-idHU8UOXjZy89vctP0";
  const GOOGLE_MAPS_API_KEY = "AIzaSyDFKTaRsE3mCxj0vcJn6ny11aNVki88ipQ";
  const IS_MOBILE = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const SSE_DESKTOP = 2;
  const SSE_MOBILE = 16;

  const CAT_COLORS = { Violent: "#FF3B5C", Property: "#3D8BFF", Drug: "#22D48B", Other: "#7C8DA0" };
  const CAT_SEVERITY_ORDER = ["Violent", "Drug", "Property", "Other"];
  const THREAT_COLORS = { high: "#FF3B5C", medium: "#FF9E40", med: "#FF9E40", low: "#FFC94D" };

  const CONFIG = {
    city: "PITTSBURGH",
    region: "PITTSBURGH · PA",
    defaultView: { lon: -79.9959, lat: 40.4406, heading: 25, pitch: -38, rangeM: 9500 },
    pointHeightM: 320,
  };

  /* ── State ────────────────────────────────────────────────────────── */
  let viewer = null;

  const S = {
    pts: [],                 // decoded incidents {la, ln, c, z, m, t, h}
    cats: [],                // category names
    zones: [],               // zone names
    types: [],               // type names
    maxMins: 0,              // window length in minutes
    minMins: 0,              // range filter floor (mins)
    typesOn: [],             // bool per type index
    activeZone: null,        // zone name or null
    range: 30,               // days
    hourIso: null,           // 0..23 or null
    sortBy: "count",
    cols: {},                // cat -> PointPrimitiveCollection
    catColor: {},            // cat -> Cesium.Color
    fade: null,              // shared NearFarScalar
    hotDS: null,             // CustomDataSource for hot boxes
    zoneEnts: {},            // zone -> { entity(main), outlines[], label }
    typeRowEls: {},          // typeIdx -> { row, count }
    counts: { total: 0, perCat: [], perZone: [], hotHigh: 0 },
  };

  /* ── DOM helpers ──────────────────────────────────────────────────── */
  const $ = (id) => document.getElementById(id);
  const fmtInt = (n) => n.toLocaleString("en-US");

  /* ── Data decode ──────────────────────────────────────────────────── */
  function decodeData() {
    const D = window.PGH_INCIDENTS;
    S.cats = D.cats;
    S.zones = D.zones;
    S.types = D.types;
    S.maxMins = Math.round((Date.parse(D.rangeEnd + "T23:59") - Date.parse(D.rangeStart)) / 60000);
    S.pts = D.points.map((p) => ({
      la: p[0] / 1e5,
      ln: p[1] / 1e5,
      c: p[2],
      z: p[3],
      m: p[4],
      t: p[5],
      h: Math.floor((p[4] % 1440) / 60),
    }));
    S.typesOn = S.types.map(() => true);
    S.counts.perZone = S.zones.map(() => 0);
    S.counts.perCat = S.cats.map(() => 0);
    for (const c of S.cats) {
      S.catColor[c] = Cesium.Color.fromCssColorString(CAT_COLORS[c]).withAlpha(c === "Violent" ? 0.98 : 0.9);
    }
    S.fade = new Cesium.NearFarScalar(180000, 1.0, 1400000, 0.35);
    applyRange(S.range);
  }

  function applyRange(days) {
    S.range = days;
    S.minMins = Math.max(0, S.maxMins - days * 1440);
    const d = new Date(Date.parse(window.PGH_INCIDENTS.rangeEnd) - (days - 1) * 86400000);
    const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    const startLbl = months[d.getUTCMonth()] + " " + String(d.getUTCDate()).padStart(2, "0");
    const end = new Date(Date.parse(window.PGH_INCIDENTS.rangeEnd));
    const endLbl = months[end.getUTCMonth()] + " " + String(end.getUTCDate()).padStart(2, "0");
    const lbl = $("time-label");
    if (lbl) lbl.textContent = startLbl + " – " + endLbl + " " + end.getUTCFullYear();
    const rs = $("stat-range");
    if (rs) rs.textContent = days + "D";
  }

  /* ── Filter ────────────────────────────────────────────────────────── */
  function visible(inc) {
    if (!S.typesOn[inc.t]) return false;
    if (inc.m < S.minMins) return false;
    if (S.activeZone !== null && inc.z !== S.activeZone) return false;
    if (S.hourIso !== null && inc.h !== S.hourIso) return false;
    return true;
  }

  /* ═══════════════════════════════════════════════════════════════════
     Module 1: Cesium init (Explorer base, Pittsburgh start)
     ═══════════════════════════════════════════════════════════════════ */
  async function initCesium() {
    if (typeof Cesium === "undefined") {
      const loader = $("loading-overlay");
      if (loader) loader.querySelector(".loader-text").textContent = "Failed to load CesiumJS from CDN";
      return false;
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

      viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString("#0B0E12");
      viewer.scene.screenSpaceCameraController.minimumZoomDistance = IS_MOBILE ? 160 : 45;

      // Start above the city, then intro-fly in (after UI builds)
      const v = CONFIG.defaultView;
      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(v.lon, v.lat - 0.055, 28000),
        orientation: { heading: Cesium.Math.toRadians(v.heading), pitch: Cesium.Math.toRadians(-55), roll: 0 },
      });

      const loader = $("loading-overlay");
      if (loader) loader.classList.add("hidden");
      console.log("[CRIME] Globe initialized.");
    } catch (err) {
      console.error("[CRIME] Init failed:", err);
      const loader = $("loading-overlay");
      if (loader) loader.querySelector(".loader-text").textContent = "Globe init failed: " + err.message;
      return false;
    }

    // Sharp satellite imagery swap (non-blocking, Explorer pattern)
    try {
      const ionImagery = await Cesium.IonImageryProvider.fromAssetId(2);
      const gLayer = viewer.imageryLayers.addImageryProvider(ionImagery);
      if (gLayer) {
        viewer.imageryLayers.raiseToTop(gLayer);
        setTimeout(function () {
          const oldBase = viewer.imageryLayers.get(0);
          if (oldBase && oldBase !== gLayer) viewer.imageryLayers.remove(oldBase);
        }, 3000);
      }
    } catch (imgErr) {
      console.warn("[CRIME] Ion imagery swap failed:", imgErr.message);
      try {
        const googleImagery = new Cesium.GoogleMapsImageryProvider({ mapType: Cesium.GoogleMapsMapType.SATELLITE });
        const gLayer2 = viewer.imageryLayers.addImageryProvider(googleImagery);
        if (gLayer2) {
          viewer.imageryLayers.raiseToTop(gLayer2);
          setTimeout(function () {
            const oldBase2 = viewer.imageryLayers.get(0);
            if (oldBase2 && oldBase2 !== gLayer2) viewer.imageryLayers.remove(oldBase2);
          }, 3000);
        }
      } catch (gErr2) {
        console.warn("[CRIME] Imagery fallback failed:", gErr2.message);
      }
    }

    // Cesium World Terrain
    try {
      const terrain = await Cesium.CesiumTerrainProvider.fromIonAssetId(1);
      viewer.terrainProvider = terrain;
    } catch (terrErr) {
      console.warn("[CRIME] World Terrain failed:", terrErr.message);
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
      } catch (e) { console.warn("[CRIME] Could not suppress tile labels:", e); }
      viewer.scene.primitives.add(tileset);
      console.log("[CRIME] 3D Tiles loaded.");
    } catch (tileErr) {
      console.warn("[CRIME] 3D Tiles failed:", tileErr.message);
    }

    return true;
  }

  /* ═══════════════════════════════════════════════════════════════════
     Module 2: Incident points
     ═══════════════════════════════════════════════════════════════════ */
  function buildPointCollections() {
    const sizes = { Violent: 7.5, Property: 6, Drug: 6, Other: 5.5 };
    for (const c of S.cats) {
      S.cols[c] = viewer.scene.primitives.add(new Cesium.PointPrimitiveCollection());
    }
    S.sizes = sizes;
  }

  function rebuildPoints() {
    for (const c of S.cats) S.cols[c].removeAll();
    S.counts.total = 0;
    S.counts.perCat = S.cats.map(() => 0);
    S.counts.perZone = S.zones.map(() => 0);

    for (let i = 0; i < S.pts.length; i++) {
      const inc = S.pts[i];
      // zone chip counts: type+range filters only (ignore zone/hour isolation)
      if (S.typesOn[inc.t] && inc.m >= S.minMins) {
        S.counts.perZone[inc.z]++;
      }
      if (!visible(inc)) continue;
      const cat = S.cats[inc.c];
      S.cols[cat].add({
        position: Cesium.Cartesian3.fromDegrees(inc.ln, inc.la, CONFIG.pointHeightM),
        pixelSize: S.sizes[cat],
        color: S.catColor[cat],
        id: i,
        translucencyByDistance: S.fade,
      });
      S.counts.total++;
      S.counts.perCat[inc.c]++;
    }
  }

  function updateStats() {
    $("stat-total").textContent = fmtInt(S.counts.total);
    const map = { Violent: "stat-violent", Property: "stat-property", Drug: "stat-drug", Other: "stat-other" };
    for (const c of S.cats) $(map[c]).textContent = fmtInt(S.counts.perCat[S.cats.indexOf(c)]);
    const hot = window.PGH_HOT;
    $("stat-hot").textContent = fmtInt(hot.highRiskCells);
    // zone chips
    const chips = document.querySelectorAll(".zone-chip");
    chips.forEach((chip) => {
      const zi = parseInt(chip.dataset.zi, 10);
      const cnt = chip.querySelector(".zone-chip-count");
      if (cnt) cnt.textContent = fmtInt(S.counts.perZone[zi] || 0);
    });
  }

  /* ═══════════════════════════════════════════════════════════════════
     Module 3: Police zone indicators
     ═══════════════════════════════════════════════════════════════════ */
  function zoneBBox(feature) {
    let w = 180, s = 90, e = -180, n = -90;
    const groups = (feature.geometry.type === "MultiPolygon")
      ? feature.geometry.coordinates
      : [feature.geometry.coordinates];
    for (const poly of groups) {
      for (const ring of poly) {
        for (const [lon, lat] of ring) {
          if (lon < w) w = lon;
          if (lat < s) s = lat;
          if (lon > e) e = lon;
          if (lat > n) n = lat;
        }
      }
    }
    return { w, s, e, n };
  }

  function buildZoneLayer() {
    const geo = window.PGH_ZONES;
    for (const feature of geo.features) {
      const z = feature.properties.zone;
      const bbox = zoneBBox(feature);
      const cLon = (bbox.w + bbox.e) / 2;
      const cLat = (bbox.s + bbox.n) / 2;
      const outlines = [];
      const groups = (feature.geometry.type === "MultiPolygon")
        ? feature.geometry.coordinates
        : [feature.geometry.coordinates];
      for (let ri = 0; ri < groups.length; ri++) {
        const poly = groups[ri];
        const flat = [];
        for (const [lon, lat] of poly[0]) flat.push(lon, lat, 330);
        const ent = viewer.entities.add({
          id: "zone-" + z + "-r" + ri,
          polyline: {
            positions: Cesium.Cartesian3.fromDegreesArrayHeights(flat),
            width: 2.5,
            material: Cesium.Color.fromCssColorString("#C9D6E2").withAlpha(0.8),
          },
        });
        outlines.push(ent);
      }
      const label = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(cLon, cLat, 345),
        label: {
          text: "ZONE " + z,
          font: '600 13px "JetBrains Mono", monospace',
          fillColor: Cesium.Color.fromCssColorString("#C9D6E2").withAlpha(0.9),
          outlineColor: Cesium.Color.fromCssColorString("#0B0E12").withAlpha(0.85),
          outlineWidth: 4,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          heightReference: Cesium.HeightReference.NONE,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
      S.zoneEnts[z] = { outlines, label, bbox };
    }
  }

  function setZoneVisual(z, active) {
    const rec = S.zoneEnts[z];
    if (!rec) return;
    for (const o of rec.outlines) {
      o.polyline.material = active
        ? Cesium.Color.fromCssColorString("#7DE0FF").withAlpha(0.95)
        : Cesium.Color.fromCssColorString("#C9D6E2").withAlpha(0.8);
      o.polyline.width = active ? 3 : 2.5;
    }
    rec.label.label.fillColor = active
      ? Cesium.Color.fromCssColorString("#7DE0FF")
      : Cesium.Color.fromCssColorString("#C9D6E2").withAlpha(0.9);
  }

  function flyToZone(z) {
    const rec = S.zoneEnts[z];
    if (!rec || !rec.bbox) return;
    const b = rec.bbox;
    const nw = Cesium.Cartesian3.fromDegrees(b.w, b.n);
    const se = Cesium.Cartesian3.fromDegrees(b.e, b.s);
    const radius = Math.max(Cesium.Cartesian3.distance(nw, se) / 2, 900);
    viewer.camera.flyToBoundingSphere(
      new Cesium.BoundingSphere(Cesium.Cartesian3.fromDegrees((b.w + b.e) / 2, (b.s + b.n) / 2), radius),
      {
        offset: new Cesium.HeadingPitchRange(
          0,
          Cesium.Math.toRadians(-38),
          radius * 2.5
        ),
        duration: 1.6,
      }
    );
  }

  /* ═══════════════════════════════════════════════════════════════════
     Module 4: Predicted hot zones (historical density model)
     ═══════════════════════════════════════════════════════════════════ */
  function gridSpacing(values) {
    const u = [...new Set(values)].sort((a, b) => a - b);
    let min = Infinity;
    for (let i = 1; i < u.length; i++) min = Math.min(min, u[i] - u[i - 1]);
    return isFinite(min) ? min : 0.0045;
  }

  function buildHotZones() {
    const hot = window.PGH_HOT;
    const cells = hot.predictions;
    const dLat = gridSpacing(cells.map((c) => c.lat));
    const dLng = gridSpacing(cells.map((c) => c.lng));
    const maxScore = Math.max(...cells.map((c) => c.dangerScore));
    S.counts.hotHigh = hot.highRiskCells;

    S.hotDS = new Cesium.CustomDataSource("hot");
    viewer.dataSources.add(S.hotDS);
    S.hotDS.show = $("hot-toggle").checked;

    for (const cell of cells) {
      const color = Cesium.Color.fromCssColorString(THREAT_COLORS[cell.threatLevel] || THREAT_COLORS.medium);
      const h = 45 + (cell.dangerScore / maxScore) * 380;
      const dx = dLng * 111320 * Math.cos(Cesium.Math.toRadians(cell.lat)) * 0.96;
      const dy = dLat * 110574 * 0.96;
      S.hotDS.entities.add({
        position: Cesium.Cartesian3.fromDegrees(cell.lng, cell.lat, h / 2 + 4),
        box: {
          dimensions: new Cesium.Cartesian3(dx, dy, h),
          material: color.withAlpha(0.16),
          outline: true,
          outlineColor: color.withAlpha(0.55),
          outlineWidth: 0.8,
        },
      });
    }

    const meta = $("hot-meta");
    if (meta) {
      meta.textContent =
        "Density model · " + hot.totalCells + " cells · " +
        hot.highRiskCells + " high-risk";
    }
  }

  /* ═══════════════════════════════════════════════════════════════════
     Module 5: Type list (category control, on/off + sort)
     ═══════════════════════════════════════════════════════════════════ */
  function typeCount(ti) {
    let n = 0;
    for (const inc of S.pts) if (inc.t === ti && inc.m >= S.minMins) n++;
    return n;
  }

  function buildTypeList() {
    const list = $("type-list");
    const scroll = list.closest(".rail-section") ? list.closest(".rail-section").scrollTop : 0;
    list.innerHTML = "";
    S.typeRowEls = {};

    const makeRow = (ti, isCatRow, catName) => {
      const name = isCatRow ? catName.toUpperCase() : S.types[ti];
      const row = document.createElement("div");
      row.className = "type-row" + (isCatRow ? " type-cat-row" : "");
      const color = isCatRow ? CAT_COLORS[catName] : CAT_COLORS[S.cats[S.pts.reduce((acc, p) => { if (p.t === ti) acc = p.c; return acc; }, 0)]];
      row.innerHTML =
        '<span class="type-dot" style="color:' + color + ';background:' + color + '"></span>' +
        '<span class="type-name">' + name + "</span>" +
        '<span class="type-count">' + fmtInt(typeCountCache[ti] !== undefined ? typeCountCache[ti] : (isCatRow ? catCountCache[catName] : 0)) + "</span>" +
        '<label class="switch" style="color:' + color + '">' +
        '<input type="checkbox" ' + (isCatRow ? (catHasOn(catName) ? "checked" : "") : (S.typesOn[ti] ? "checked" : "")) + ">" +
        '<span class="switch-track"></span></label>';
      const input = row.querySelector("input");
      input.addEventListener("click", (e) => e.stopPropagation());
      input.addEventListener("change", () => {
        if (isCatRow) setCategory(catName, input.checked);
        else {
          S.typesOn[ti] = input.checked;
          row.classList.toggle("disabled", !input.checked);
          refreshAfterFilter();
        }
      });
      row.addEventListener("click", () => {
        input.checked = !input.checked;
        input.dispatchEvent(new Event("change"));
      });
      if (isCatRow) {
        row.style.paddingTop = "9px";
        row.style.paddingBottom = "9px";
        row.style.borderTop = "1px solid var(--hair)";
        row.querySelector(".type-name").style.fontWeight = "700";
      } else if (!S.typesOn[ti]) {
        row.classList.add("disabled");
      }
      return row;
    };

    // cache counts once per build
    const catOfType = (ti) => {
      for (const p of S.pts) if (p.t === ti) return S.cats[p.c];
      return "Other";
    };
    const typeCountCache = {};
    const catCountCache = {};
    for (let ti = 0; ti < S.types.length; ti++) typeCountCache[ti] = typeCount(ti);
    for (const c of S.cats) catCountCache[c] = 0;
    for (let ti = 0; ti < S.types.length; ti++) {
      const cat = catOfType(ti);
      catCountCache[cat] += typeCountCache[ti];
    }

    const catHasOn = (cat) => {
      for (let ti = 0; ti < S.types.length; ti++) if (catOfType(ti) === cat && S.typesOn[ti]) return true;
      return false;
    };
    const typesInCat = (cat) => {
      const out = [];
      for (let ti = 0; ti < S.types.length; ti++) if (catOfType(ti) === cat) out.push(ti);
      return out;
    };

    if (S.sortBy === "alpha") {
      const order = [...Array(S.types.length).keys()].sort((a, b) => S.types[a].localeCompare(S.types[b]));
      for (const ti of order) {
        const row = makeRow(ti, false, null);
        list.appendChild(row);
        S.typeRowEls[ti] = { row, count: row.querySelector(".type-count") };
      }
    } else {
      let catOrder;
      if (S.sortBy === "severity") {
        catOrder = CAT_SEVERITY_ORDER.filter((c) => S.cats.includes(c));
      } else {
        catOrder = [...S.cats].sort((a, b) => catCountCache[b] - catCountCache[a]);
      }
      for (const cat of catOrder) {
        list.appendChild(makeRow(-1, true, cat));
        const idxs = typesInCat(cat).sort((a, b) => typeCountCache[b] - typeCountCache[a]);
        for (const ti of idxs) {
          const row = makeRow(ti, false, null);
          row.style.paddingLeft = "14px";
          list.appendChild(row);
          S.typeRowEls[ti] = { row, count: row.querySelector(".type-count") };
        }
      }
    }
    const rail = list.closest(".rail-section");
    if (rail) rail.scrollTop = scroll;
  }

  function setCategory(cat, on) {
    for (let ti = 0; ti < S.types.length; ti++) {
      let catOf = null;
      for (const p of S.pts) { if (p.t === ti) { catOf = S.cats[p.c]; break; } }
      if (catOf === cat) S.typesOn[ti] = on;
    }
    refreshAfterFilter();
    buildTypeList();
  }

  /* ═══════════════════════════════════════════════════════════════════
     Module 6: Zone chips
     ═══════════════════════════════════════════════════════════════════ */
  function buildZoneChips() {
    const wrap = $("zone-list");
    wrap.innerHTML = "";
    S.zones.forEach((z, zi) => {
      const chip = document.createElement("button");
      chip.className = "zone-chip";
      chip.dataset.zi = String(zi);
      chip.dataset.zone = z;
      const label = z === "Outside City" ? "OC" : "Z" + z;
      chip.innerHTML =
        '<span class="zone-chip-label">' + label + "</span>" +
        '<span class="zone-chip-count">0</span>';
      chip.addEventListener("click", () => {
        if (S.activeZone === z) clearZoneIsolation();
        else isolateZone(z);
      });
      wrap.appendChild(chip);
    });
    $("zone-all-btn").addEventListener("click", clearZoneIsolation);
  }

  function isolateZone(z) {
    if (S.activeZone !== null) {
      setZoneVisual(S.activeZone, false);
      document.querySelectorAll(".zone-chip").forEach((c) => c.classList.remove("active"));
    }
    S.activeZone = z;
    const chip = document.querySelector('.zone-chip[data-zone="' + z + '"]');
    if (chip) chip.classList.add("active");
    if (S.zoneEnts[z]) setZoneVisual(z, true);
    flyToZone(z);
    openZoneCard(z);
    refreshAfterFilter();
  }

  function clearZoneIsolation() {
    if (S.activeZone === null) return;
    if (S.zoneEnts[S.activeZone]) setZoneVisual(S.activeZone, false);
    S.activeZone = null;
    document.querySelectorAll(".zone-chip").forEach((c) => c.classList.remove("active"));
    closeZoneCard();
    refreshAfterFilter();
  }

  /* ═══════════════════════════════════════════════════════════════════
     Module 7: Hour histogram
     ═══════════════════════════════════════════════════════════════════ */
  function buildHistogram() {
    const wrap = $("hour-histogram");
    wrap.innerHTML = "";
    for (let h = 0; h < 24; h++) {
      const bar = document.createElement("div");
      bar.className = "hour-bar";
      bar.dataset.hour = String(h);
      bar.addEventListener("click", () => {
        S.hourIso = S.hourIso === h ? null : h;
        refreshAfterFilter();
      });
      wrap.appendChild(bar);
    }
  }

  function updateHistogram() {
    const counts = new Array(24).fill(0);
    for (const inc of S.pts) {
      if (S.typesOn[inc.t] && inc.m >= S.minMins && (S.activeZone === null || inc.z === S.activeZone)) {
        counts[inc.h]++;
      }
    }
    const max = Math.max(...counts, 1);
    const bars = document.querySelectorAll(".hour-bar");
    bars.forEach((bar) => {
      const h = parseInt(bar.dataset.hour, 10);
      bar.style.height = Math.max((counts[h] / max) * 100, 3) + "%";
      bar.title = String(h).padStart(2, "0") + ":00 · " + fmtInt(counts[h]) + " incidents";
      bar.classList.toggle("isolated", S.hourIso === h);
      bar.classList.toggle("peak", counts[h] === max && max > 1);
    });
  }

  /* ═══════════════════════════════════════════════════════════════════
     Module 8: Incident drawer + zone card
     ═══════════════════════════════════════════════════════════════════ */
  const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

  function incDate(inc) {
    const d = new Date(Date.parse(window.PGH_INCIDENTS.rangeStart) + inc.m * 60000);
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const time = String(d.getUTCHours()).padStart(2, "0") + String(d.getUTCMinutes()).padStart(2, "0");
    return {
      label: MONTHS[d.getUTCMonth()] + " " + dd + " " + d.getUTCFullYear(),
      time: time,
      monthDay: mm + dd,
    };
  }

  function caseId(idx, inc) {
    const d = incDate(inc);
    return "PGH-" + d.monthDay + "-" + String(1000 + ((idx * 2654435761) % 9000));
  }

  function relatedCount(inc) {
    const dLat = 600 / 111320;
    const dLng = 600 / (111320 * Math.cos(Cesium.Math.toRadians(inc.la)));
    let n = 0;
    for (const o of S.pts) {
      if (o.t !== inc.t || o === inc) continue;
      if (Math.abs(o.m - inc.m) > 4320) continue;
      if (Math.abs(o.la - inc.la) > dLat || Math.abs(o.ln - inc.ln) > dLng) continue;
      if (!visible(o)) continue;
      n++;
    }
    return n;
  }

  function openIncident(idx) {
    const inc = S.pts[idx];
    const type = S.types[inc.t];
    const cat = S.cats[inc.c];
    const zone = S.zones[inc.z];
    const d = incDate(inc);
    const rel = relatedCount(inc);
    closeZoneCard(true);

    const body = $("drawer-body");
    body.innerHTML =
      '<div class="d-case">' + caseId(idx, inc) + "</div>" +
      '<div class="d-type">' + type + "</div>" +
      '<div class="d-cat" style="color:' + CAT_COLORS[cat] + '">' +
      '<i style="background:' + CAT_COLORS[cat] + '"></i>' + cat.toUpperCase() + "</div>" +
      '<div class="d-fields">' +
      '<div class="d-field"><span class="label">ZONE</span><span class="value">' +
      (zone === "Outside City" ? "OUTSIDE CITY" : "ZONE " + zone) + "</span></div>" +
      '<div class="d-field"><span class="label">DATE</span><span class="value">' + d.label + "</span></div>" +
      '<div class="d-field"><span class="label">TIME</span><span class="value">' + d.time + " LT</span></div>" +
      '<div class="d-field"><span class="label">COORDS</span><span class="value">' +
      inc.la.toFixed(5) + ", " + inc.ln.toFixed(5) + "</span></div>" +
      '<div class="d-field"><span class="label">RELATED</span><span class="value">' +
      rel + " same type · 600m · 72h</span></div>" +
      "</div>";
    $("incident-drawer").classList.add("open");
    closeLayerSheet();
  }

  function openZoneCard(z) {
    closeDrawer(true);
    const isOC = z === "Outside City";
    const title = isOC ? "OUTSIDE CITY" : "ZONE " + z;

    // live top types within current filters (ignoring the zone isolation itself)
    const byType = {};
    let total = 0;
    for (const inc of S.pts) {
      if (S.zones[inc.z] !== z) continue;
      if (inc.m < S.minMins || !S.typesOn[inc.t]) continue;
      byType[S.types[inc.t]] = (byType[S.types[inc.t]] || 0) + 1;
      total++;
    }
    const top = Object.entries(byType).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const maxTop = top.length ? top[0][1] : 1;

    let hoods = "";
    if (!isOC && window.PGH_ZSTATS && window.PGH_ZSTATS.zones[z]) {
      const zs = window.PGH_ZSTATS.zones[z].all;
      if (zs && zs.topNeighborhoods && zs.topNeighborhoods.length) {
        hoods =
          '<div class="d-field" style="margin-top:10px"><span class="label">TOP AREAS</span></div>' +
          '<div style="font-family:var(--mono);font-size:.62rem;color:var(--dim);line-height:1.7;padding-top:4px">' +
          zs.topNeighborhoods.slice(0, 4).map((n) => (Array.isArray(n) ? n[0] : n)).join(" · ") +
          "</div>";
      }
    }

    let rows = "";
    for (const [name, count] of top) {
      rows +=
        '<div class="zc-bar-row"><span class="zc-bar-label">' + name + "</span>" +
        '<span class="zc-bar"><i style="width:' + Math.round((count / maxTop) * 100) + '%"></i></span>' +
        '<span class="zc-bar-count">' + fmtInt(count) + "</span></div>";
    }

    $("zone-card-body").innerHTML =
      '<div class="d-case">' + title + "</div>" +
      '<div class="d-type">' + fmtInt(total) + ' <span style="font-size:.6rem;color:var(--dim)">INCIDENTS · ' + S.range + 'D</span></div>' +
      (rows || '<div style="color:var(--faint);font-size:.7rem;padding:8px 0">No incidents match current filters.</div>') +
      hoods;
    $("zone-card").classList.add("open");
    closeLayerSheet();
  }

  function closeDrawer(keepZone) {
    $("incident-drawer").classList.remove("open");
    if (!keepZone) return;
  }
  function closeZoneCard(keepDrawer) {
    $("zone-card").classList.remove("open");
  }

  function closeLayerSheet() {
    const rail = $("rail"), fab = $("layers-fab");
    if (rail) rail.classList.remove("open");
    if (fab) fab.classList.remove("active");
  }

  /* ═══════════════════════════════════════════════════════════════════
     Module 9: Pick (points + zones)
     ═══════════════════════════════════════════════════════════════════ */
  function setupPick() {
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((movement) => {
      const picked = viewer.scene.pick(movement.position);
      if (!Cesium.defined(picked)) return;
      const id = picked.id;
      if (typeof id === "number") {
        viewer.scene.canvas.style.cursor = "pointer";
        openIncident(id);
        return;
      }
      if (id instanceof Cesium.Entity && typeof id.id === "string") {
        const m = id.id.match(/^zone-(.+?)-r\d+$/);
        if (m) isolateZone(m[1]);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // pointer cursor over incidents
    handler.setInputAction((movement) => {
      const picked = viewer.scene.pick(movement.endPosition);
      const isPt = Cesium.defined(picked) && typeof picked.id === "number";
      viewer.scene.canvas.style.cursor = isPt ? "pointer" : "default";
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
  }

  /* ═══════════════════════════════════════════════════════════════════
     Module 10: Search (Explorer pattern)
     ═══════════════════════════════════════════════════════════════════ */
  function doSearch() {
    const query = ($("location-search").value || "").trim();
    if (!query || !viewer) return;

    const coordMatch = query.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lon = parseFloat(coordMatch[2]);
      const tiltDeg = 45;
      viewer.camera.flyToBoundingSphere(
        new Cesium.BoundingSphere(Cesium.Cartesian3.fromDegrees(lon, lat), 1),
        {
          offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-tiltDeg), 5000 / Math.sin(Cesium.Math.toRadians(tiltDeg))),
          duration: 2.0,
        }
      );
      return;
    }

    const geocodeBase = "https://maps.googleapis.com/maps/api/geocode/json";
    const params = new URLSearchParams({ address: query, key: GOOGLE_MAPS_API_KEY });
    fetch(geocodeBase + "?" + params.toString())
      .then((r) => r.json())
      .then((data) => {
        if (data.status === "OK" && data.results.length > 0) {
          const loc = data.results[0].geometry.location;
          const vp = data.results[0].geometry.viewport;
          const widthM = Cesium.Math.toRadians(vp.northeast.lng - vp.southwest.lng) * 6371000;
          const altM = Math.max(widthM * 0.8, 300);
          const tiltDeg = 35;
          viewer.camera.flyToBoundingSphere(
            new Cesium.BoundingSphere(Cesium.Cartesian3.fromDegrees(loc.lng, loc.lat), 1),
            {
              offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-tiltDeg), altM / Math.sin(Cesium.Math.toRadians(tiltDeg))),
              duration: 2.0,
            }
          );
        } else {
          alert("Location not found: " + query);
        }
      })
      .catch((err) => console.warn("[CRIME] Geocode error:", err));
  }

  /* ═══════════════════════════════════════════════════════════════════
     Module 11: Orbit pad (Explorer pattern)
     ═══════════════════════════════════════════════════════════════════ */
  const pad = {
    active: false, target: null, range: 0, heading: 0, pitch: 0,
    lastX: 0, lastY: 0, vel: 0, raf: null, thumbDX: 0, thumbDY: 0,
  };
  const HEADING_SENS = 1.0;
  const PITCH_SENS = 0.4;
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
    if (viewer && viewer.camera) viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
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

  /* ── Readouts ─────────────────────────────────────────────────────── */
  function compassLabel(h) {
    const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    return dirs[Math.round(h / 45) % 8];
  }

  function updateReadouts() {
    const hEl = $("readout-heading");
    const pEl = $("readout-pitch");
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
    const thumb = $("pad-thumb");
    if (thumb) thumb.style.transform = "translate(" + pad.thumbDX + "px, " + pad.thumbDY + "px)";
  }

  function resetThumb() {
    pad.thumbDX = 0; pad.thumbDY = 0;
    updateThumb();
  }

  function setupReadouts() {
    if (!viewer) return;
    viewer.camera.changed.addEventListener(updateReadouts);
    const kill = function () { if (!pad.active) stopInertia(); };
    viewer.scene.canvas.addEventListener("wheel", kill, { passive: true });
    viewer.scene.canvas.addEventListener("pointerdown", kill, { passive: true });
    viewer.scene.canvas.addEventListener("touchstart", kill, { passive: true });
  }

  /* ═══════════════════════════════════════════════════════════════════
     Module 12: UI wiring
     ═══════════════════════════════════════════════════════════════════ */
  function refreshAfterFilter() {
    rebuildPoints();
    updateStats();
    updateHistogram();
    // live zone card refresh if open
    if (S.activeZone !== null && $("zone-card").classList.contains("open")) {
      openZoneCard(S.activeZone);
    }
  }

  function setupUI() {
    // sort chips
    document.querySelectorAll(".sort-chip").forEach((chip) => {
      chip.classList.toggle("active", chip.dataset.sort === S.sortBy);
      chip.addEventListener("click", () => {
        S.sortBy = chip.dataset.sort;
        document.querySelectorAll(".sort-chip").forEach((c) => c.classList.toggle("active", c === chip));
        buildTypeList();
      });
    });

    // range chips
    document.querySelectorAll(".range-chip").forEach((chip) => {
      chip.classList.toggle("active", parseInt(chip.dataset.range, 10) === S.range);
      chip.addEventListener("click", () => {
        document.querySelectorAll(".range-chip").forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
        applyRange(parseInt(chip.dataset.range, 10));
        refreshAfterFilter();
        buildTypeList();
      });
    });

    // hot toggle
    $("hot-toggle").addEventListener("change", () => {
      if (S.hotDS) S.hotDS.show = $("hot-toggle").checked;
    });

    // search
    $("search-btn").addEventListener("click", doSearch);
    $("location-search").addEventListener("keydown", (e) => { if (e.key === "Enter") doSearch(); });

    // orbit pad
    const padEl = $("orbit-pad");
    padEl.addEventListener("pointerdown", padPointerDown);
    padEl.addEventListener("pointermove", padPointerMove);
    padEl.addEventListener("pointerup", padPointerUp);
    padEl.addEventListener("pointercancel", padPointerUp);

    // drawers
    $("drawer-close").addEventListener("click", () => closeDrawer());
    $("zone-card-close").addEventListener("click", () => { clearZoneIsolation(); });

    // mobile layers sheet
    const fab = $("layers-fab");
    if (fab) {
      fab.addEventListener("click", () => {
        const open = $("rail").classList.toggle("open");
        fab.classList.toggle("active", open);
      });
    }
    const sheetClose = $("sheet-close");
    if (sheetClose) {
      sheetClose.addEventListener("click", closeLayerSheet);
    }

    // Esc closes panels
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if ($("incident-drawer").classList.contains("open")) closeDrawer();
        else if (S.activeZone !== null) clearZoneIsolation();
        else closeLayerSheet();
      }
    });

    setupPick();
  }

  /* ═══════════════════════════════════════════════════════════════════
     Boot
     ═══════════════════════════════════════════════════════════════════ */
  async function boot() {
    decodeData();
    const ok = await initCesium();
    if (!ok) return;

    const safe = (name, fn) => {
      try {
        fn();
      } catch (e) {
        window.__BOOT_ERR = (window.__BOOT_ERR ? window.__BOOT_ERR + " | " : "") + name + ": " + (e && e.message);
        console.error("[CRIME] " + name + " failed:", e);
      }
    };
    safe("points", buildPointCollections);
    safe("zones", buildZoneLayer);
    safe("hot", buildHotZones);
    safe("chips", buildZoneChips);
    safe("histogram", buildHistogram);
    safe("types", buildTypeList);
    setupUI();
    setupReadouts();
    refreshAfterFilter();

    // Intro flight into the city
    const v = CONFIG.defaultView;
    viewer.camera.flyToBoundingSphere(
      new Cesium.BoundingSphere(Cesium.Cartesian3.fromDegrees(v.lon, v.lat), 1),
      {
        offset: new Cesium.HeadingPitchRange(
          Cesium.Math.toRadians(v.heading),
          Cesium.Math.toRadians(v.pitch),
          v.rangeM / Math.sin(Cesium.Math.toRadians(-v.pitch))
        ),
        duration: 2.6,
      }
    );
    console.log("[CRIME] PGH Crime Intel ready · " + S.pts.length + " incidents loaded.");
  }

  document.addEventListener("DOMContentLoaded", boot);
})();