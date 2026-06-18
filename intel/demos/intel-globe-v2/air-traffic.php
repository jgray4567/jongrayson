<?php
error_reporting(E_ALL & ~E_DEPRECATED);
header('Content-Type: application/json');
header('Cache-Control: no-store, max-age=0');
header('Access-Control-Allow-Origin: *');

$cachePath = dirname(__DIR__) . '/data/air-traffic-cache.json';
$cacheTtl = 300; // 5 min cache — OpenSky rate limits anonymous requests

$emit = function ($payload) {
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
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
$cacheKey = implode(',', $requestedRegions);

// Read cache file (always the 'all' cache)
$allCache = null;
if (file_exists($cachePath)) {
    $decoded = json_decode(file_get_contents($cachePath), true);
    if (is_array($decoded) && isset($decoded['items'])) {
        $allCache = $decoded;
    }
}

// 1. If requesting 'all' and cache is fresh, serve it
if ($useAllRegions && $allCache && isset($allCache['fetchedAt']) && (time() - intval($allCache['fetchedAt'])) < $cacheTtl) {
    $allCache['source'] = 'cache';
    $emit($allCache);
}

// 2. If requesting specific regions and cache is fresh, filter and serve
if (!$useAllRegions && $allCache && isset($allCache['fetchedAt']) && (time() - intval($allCache['fetchedAt'])) < $cacheTtl) {
    $filteredItems = [];
    foreach ($allCache['items'] as $item) {
        $lat = $item['lat']; $lng = $item['lng'];
        foreach ($requestedRegions as $r) {
            if (isset($regions[$r])) {
                $b = $regions[$r];
                if ($lat >= $b[0] && $lat <= $b[1] && $lng >= $b[2] && $lng <= $b[3]) {
                    $filteredItems[] = $item;
                    break;
                }
            }
        }
    }
    $filtered = $allCache;
    $filtered['items'] = $filteredItems;
    $filtered['count'] = count($filteredItems);
    $filtered['cacheKey'] = $cacheKey;
    $filtered['source'] = 'cache-filtered';
    $emit($filtered);
}

// 3. Cache is stale or missing — try to fetch from OpenSky
$url = 'https://opensky-network.org/api/states/all';
$raw = null;
$httpCode = 0;

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
    curl_close($ch);
    if ($httpCode !== 200) $raw = false;
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

// 4. If fetch succeeded, process and cache
if ($raw && $raw !== '') {
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

        if ($alt < 3000 || $velocity <= 25) continue;
        if (!preg_match('/^[A-Z]{3}[0-9]{1,4}[A-Z]?$/i', $callsign)) continue;

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

    if (count($items) > 500) {
        shuffle($items);
        $items = array_slice($items, 0, 500);
    }

    // Always cache as 'all'
    $payload = [
        'items' => $items,
        'fetchedAt' => time(),
        'count' => count($items),
        'cacheKey' => 'all',
        'regions' => ['all'],
    ];
    @file_put_contents($cachePath, json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");

    // Filter by region if needed
    if (!$useAllRegions) {
        $filteredItems = [];
        foreach ($items as $item) {
            $lat = $item['lat']; $lng = $item['lng'];
            foreach ($requestedRegions as $r) {
                if (isset($regions[$r])) {
                    $b = $regions[$r];
                    if ($lat >= $b[0] && $lat <= $b[1] && $lng >= $b[2] && $lng <= $b[3]) {
                        $filteredItems[] = $item;
                        break;
                    }
                }
            }
        }
        $payload['items'] = $filteredItems;
        $payload['count'] = count($filteredItems);
        $payload['cacheKey'] = $cacheKey;
        $payload['regions'] = $requestedRegions;
    }
    $payload['source'] = 'live';
    $emit($payload);
}

// 5. Fetch failed — serve stale cache if available (better than nothing)
if ($allCache && isset($allCache['items'])) {
    if (!$useAllRegions) {
        $filteredItems = [];
        foreach ($allCache['items'] as $item) {
            $lat = $item['lat']; $lng = $item['lng'];
            foreach ($requestedRegions as $r) {
                if (isset($regions[$r])) {
                    $b = $regions[$r];
                    if ($lat >= $b[0] && $lat <= $b[1] && $lng >= $b[2] && $lng <= $b[3]) {
                        $filteredItems[] = $item;
                        break;
                    }
                }
            }
        }
        $allCache['items'] = $filteredItems;
        $allCache['count'] = count($filteredItems);
        $allCache['cacheKey'] = $cacheKey;
    }
    $allCache['stale'] = true;
    $allCache['source'] = 'stale-cache';
    $emit($allCache);
}

// 6. No cache, no live data — error
http_response_code(502);
$emit(['error' => 'fetch_failed', 'http_code' => $httpCode, 'items' => []]);