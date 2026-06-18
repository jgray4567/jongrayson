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

// Region bounding boxes [minLat, maxLat, minLng, maxLng]
$regions = [
    'north-america' => [25, 75, -170, -50],
    'mexico'        => [14, 33, -118, -86],
    'europe'        => [35, 72, -15, 45],
    'asia'          => [0, 75, 45, 180],
    'middle-east'   => [12, 42, 25, 65],
    'south-america' => [-60, 15, -85, -35],
    'africa'        => [-40, 38, -20, 55],
    'oceania'       => [-50, 0, 110, 180],
];

// Get requested regions from query param
$requestedRegions = isset($_GET['regions']) ? explode(',', $_GET['regions']) : ['all'];
$useAllRegions = in_array('all', $requestedRegions);

// Check cache (keyed by requested regions)
$cacheKey = implode(',', $requestedRegions);
$cached = $readCache();
if ($cached && isset($cached['fetchedAt']) && isset($cached['cacheKey']) && $cached['cacheKey'] === $cacheKey && (time() - intval($cached['fetchedAt'])) < $cacheTtl) {
    $emit($cached);
}

$url = 'https://opensky-network.org/api/states/all';

// Try cURL first (more reliable on shared hosting), fall back to file_get_contents
$raw = null;
if (function_exists('curl_init')) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_USERAGENT => 'intel-globe-v2/1.0',
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_FOLLOWLOCATION => true,
    ]);
    $raw = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    if ($httpCode !== 200) $raw = false;
    curl_close($ch);
}
if ($raw === null) {
    $ctx = stream_context_create([
        'http' => [
            'method' => 'GET',
            'timeout' => 15,
            'header' => "User-Agent: intel-globe-v2/1.0\r\n"
        ],
        'ssl' => ['verify_peer' => true, 'verify_peer_name' => true]
    ]);
    $raw = @file_get_contents($url, false, $ctx);
}

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
    $lat = $s[6];
    $lng = $s[5];

    // Only airborne commercial flights at cruising altitude (> 3000m / ~10,000ft)
    if ($alt < 3000 || $velocity <= 25) continue;

    // Only commercial callsigns (3-letter IATA prefix + flight number)
    if (!preg_match('/^[A-Z]{3}[0-9]{1,4}[A-Z]?$/i', $callsign)) continue;

    // Filter by region if not requesting all
    if (!$useAllRegions) {
        $inRegion = false;
        foreach ($requestedRegions as $r) {
            if (isset($regions[$r])) {
                $b = $regions[$r];
                if ($lat >= $b[0] && $lat <= $b[1] && $lng >= $b[2] && $lng <= $b[3]) {
                    $inRegion = true;
                    break;
                }
            }
        }
        if (!$inRegion) continue;
    }

    $items[] = [
        'icao24' => $s[0],
        'callsign' => $callsign,
        'origin' => $s[2] ?? '',
        'lng' => $lng,
        'lat' => $lat,
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
    'cacheKey' => $cacheKey,
    'regions' => $requestedRegions,
];
$writeCache($payload);
$emit($payload);