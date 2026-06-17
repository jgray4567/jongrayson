// Three.js global bridge for satellite custom layer
// Loads Three.js as ESM and exposes as window.THREE
// Globe.gl bundles Three.js v0.179+ internally but doesn't expose it globally
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.179.0/build/three.module.min.js';
window.THREE = THREE;
window.dispatchEvent(new Event('three-ready'));