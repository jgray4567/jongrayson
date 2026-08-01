# Intel Layer — Global Situation Awareness

A live multi-source situational-awareness globe: air traffic, orbital assets,
seismic events, weather warnings, thermal anomalies and maritime tracks on one
3D Earth, with a searchable entity index and per-source integrity monitoring.

Live: `/intel/demos/intel-globe-v2/`

---

## Running locally

The page's data endpoints are PHP. `dev-server.py` serves the site tree from
disk and proxies every `*.php` request to the live host, so all real feeds work
locally without a PHP runtime:

```bash
python3 intel/demos/intel-globe-v2/dev-server.py
```

Then open <http://127.0.0.1:8747/intel/demos/intel-globe-v2/>.

---

## Design rules

These are load-bearing. Breaking one is a defect, not a style change.

**1. Colour is semantic. Red is reserved for threat to life.**
Nothing else on the globe renders red — not an orbit class, not an altitude
band, not a UI accent. Before this rebuild `#ff6644` meant both "GEO satellite"
and "M4.5 earthquake", and `#ffaa22` meant both "MEO" and "weather alert". If
an operator sees red it means people are in danger. Seismic events escalate
onto the threat ramp only at M6.0, the point at which an event is reliably
destructive.

**2. Nothing renders below a legibility floor.**
Every marker is sized in screen space with a hard pixel minimum
(`screenScale()` in `intel-core.js`). Fixed world-space sizes go sub-pixel when
you zoom out and become occluding blobs when you zoom in. Geometry passed to
`screenScale` must be **unit diameter**, not unit radius.

**3. Extrapolated data is always marked as such.**
Aircraft positions are dead-reckoned between five-minute polls. The symbol
desaturates as confidence decays and the dossier states the age of the last
observed fix in plain language. An operator must never be unable to tell an
observation from a computation.

**4. A source that fails says so, loudly.**
`FeedMonitor` knows each feed's expected cadence and escalates on its own
clock — a feed that has hung cannot report its own failure. Failure raises a
toast, turns the top-bar posture chip red, and flags the source. A feed can
also be **pinned** to a state that freshness must not override: the maritime
endpoint answers promptly with entirely synthetic vessels, so it is pinned
`DEGRADED` and labelled `SIMULATED`. Recency is not trustworthiness.

**5. A control must never assert a state the scene does not have.**
`syncLayerControls()` reconciles every checkbox against the actual scene graph
at boot. The previous version shipped `<input checked>` in markup,
`visible = false` in init, and a hardcoded `"OFF"` label — three sources of
truth, none of them the renderer.

**6. If an operator cannot find it, the tool has failed.**
Every layer registers its entities in the shared `EntityRegistry`. The command
palette (`⌘K` / `/`) fuzzy-searches that index and nothing else. **A layer that
renders without registering is invisible to search — treat that as a bug.**

---

## Architecture

| File | Role |
|---|---|
| `intel-core.js` | Palette, geodesy (ENU basis, dead reckoning), `screenScale`, `EntityRegistry`, `SelectionBus`, `FeedMonitor` |
| `aircraft-layer.js` | Air picture — instanced, dead-reckoned, altitude-banded, trails, screen-space picking |
| `orbital-layer.js` | Space picture — instanced, log-compressed altitude with drawn reference shells, ground tracks |
| `mission-ui.js` / `mission-ui.css` | Command palette, dossier, source-integrity popover, legend, keyboard map |
| `index.html` | Scene, Earth, cities, hotspots, seismic/weather/storm feeds, interaction resolver, animation loop |
| `fires-layer.js` | NASA FIRMS VIIRS thermal anomalies (globe.gl-era module, adapted) |
| `ships-layer.js` | Maritime AIS (globe.gl-era module, adapted) |
| `timeline-engine.js` | Snapshot capture + replay scrubber |

Aircraft and satellites are owned entirely by their layer classes. They have no
module-level groups, data arrays or filter state in `index.html`.

### Interaction

One resolver (`resolveAt`) serves mouse, touch and click. Aircraft and
satellites resolve by **screen-space distance** with a pixel-denominated hit
radius, so the click target is equally large at every zoom; surface markers
still raycast. A screen-space hit within 9 px wins over a raycast hit.

Selection is **sticky** — it survives pointer movement, data refresh and camera
motion, and drives the dossier. The tooltip answers "what is this?"; the
dossier is the detail view.

### Keyboard

`⌘K` or `/` search · `?` keyboard map · `L` legend · `H` source integrity
`T` lock camera to selection · `C` copy coordinates · `R` reset view
`1`–`9` toggle layers · `Esc` clear selection

---

## Gotchas

**Opaque vs transparent queues.** three.js renders the *entire* opaque queue
before the *entire* transparent queue; `renderOrder` only sorts within a queue.
The dark keyline behind each aircraft and the halo behind each satellite must
be `transparent: false`, or they draw over the marker they exist to outline.
This is why satellites rendered as featureless dark diamonds.

**Never promote `<body>` to `position: relative`.** Every panel here is
absolutely positioned, so the body computes to zero height. Making it a
containing block re-parents every `bottom: 0` element to a 0px-tall block and
throws the timeline bar and ticker off the top of the screen.

**Script order.** `timeline-engine.js`, `fires-layer.js` and `ships-layer.js`
are classic scripts that must be declared **before** the inline
`type="module"`. Inline modules are deferred and run in document order, so a
classic script placed after the module loads too late and the module sees
`typeof FiresLayer === "undefined"`.

**Those two layers expect a global `THREE`.** They guard every geometry call
with `typeof THREE === 'undefined'`. `index.html` sets `window.THREE` before
constructing them. Without it they no-op silently — `FiresLayer` will happily
report 5 000 fetched detections and zero meshes.

**They were also written for globe.gl** (radius 100, `getCoords(lat, lng, alt)`
with `alt` as a fraction of radius). `initExtendedLayers()` supplies an adapter
returning a real `THREE.Vector3`, and scales marker geometry by `radius / 100`.
`init()` builds the group; **`enable()` is what adds it to the scene.**

**Desktop rail geometry is scoped to `min-width: 851px`.** Below that the page
uses an off-canvas drawer system; applying desktop rail rules there (especially
with `!important`) pins the drawers open.

**Aircraft heading is `true_track` in DEGREES**, clockwise from north — OpenSky
state-vector index 10. Passing it to `Math.cos`/`Math.sin` as radians is the
bug that had every aircraft on the globe pointing in an arbitrary direction.
Use `tangentQuaternion(lat, lng, headingDeg)`.

---

## Scale conventions

Stated here because they are deliberate distortions, and the legend says so too:

- **Aircraft altitude is exaggerated ×8.** True cruise altitude is ~0.2% of
  Earth's radius and would be invisible.
- **Orbital altitude is logarithmically compressed** so LEO through GEO fit one
  view. The drawn shell rings mark the true regime boundaries.
- **Horizontal position, heading, ground tracks and sub-satellite points are
  geometrically exact.**

## Known limitations

- Weather and storm alerts are **US only** (NWS coverage).
- The maritime endpoint currently returns synthetic vessels; the layer is off
  by default and pinned `DEGRADED`/`SIMULATED` when enabled.
- The timeline scrubber replays only what it has captured since page load. It
  says so until it has enough snapshots to be useful.
- Hotspots are a curated editorial reference set, not a live feed. The dossier
  states this.
