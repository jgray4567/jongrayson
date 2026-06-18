<?php
header('Content-Type: application/json');
header('Cache-Control: no-store, max-age=0');
header('Access-Control-Allow-Origin: *');

$cachePath = dirname(__DIR__) . '/data/air-traffic-cache.json';
$cacheTtl = 30;

$emit = function ($payload) {
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
};

$readCache = function () use ($cachePath) {
    if (!file_exists($cachePath)) return null;
    $decoded = json_decode(file_get_contents($cachePath), true);
    return is_array($decoded) ? $decoded : null;
};

$writeCache = function ($payload) use ($cachePath) {
    @file_put_contents($cachePath, json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");
};

$cached = $readCache();
if ($cached && isset($cached['fetchedAt']) && (time() - intval($cached['fetchedAt'])) < $cacheTtl) {
    $emit($cached);
}

$url = 'https://opensky-network.org/api/states/all';
$ctx = stream_context_create([
    'http' => [
        'method' => 'GET',
        'timeout' => 15,
        'header' => "User-Agent: intel-globe-v2/1.0\r\n"
    ],
    'ssl' => ['verify_peer' => true, 'verify_peer_name' => true]
]);

$raw = @file_get_contents($url, false, $ctx);
if ($raw === false) {
    if ($cached) $emit($cached + ['stale' => true]);
    http_response_code(502);
    $emit(['error' => 'fetch_failed', 'items' => []]);
}

$decoded = json_decode($raw, true);
$states = $decoded['states'] ?? [];

$items = [];
foreach ($states as $s) {
    if (!is_array($s)) continue;
    if ($s[5] === null || $s[6] === null || $s[7] === null) continue;
    $alt = $s[7];
    $callsign = trim($s[1] ?? '');
    $velocity = $s[9] ?? 0;

:    // Only airborne commercial flights at cruising altitude (> 3000m / ~10,000ft)
    // This excludes climbing/descending aircraft and shows only established routes
    if ($alt < 3000 || $velocity <= 25) continue;

    // Only commercial callsigns (3-letter IATA prefix + flight number)
    // This filters out private, military, and ground vehicles
    if (!preg_match('/^[A-Z]{3}[0-9]{1,4}[A-Z]?$/i', $callsign)) continue;

    $items[] = [
        'icao24' => $s[0],
        'callsign' => $callsign,
        'origin' => $s[2] ?? '',
        'lng' => $s[5],
        'lat' => $s[6],
        'alt' => $alt,
        'velocity' => $velocity,
        'heading' => $s[10] ?? null,
    ];
}

// Cap at 500 for clean display
if (count($items) > 500) {
    shuffle($items);
    $items = array_slice($items, 0, 500);
}

$payload = [
    'items' => $items,
    'fetchedAt' => time(),
    'count' => count($items),
];
$writeCache($payload);
$emit($payload);