<?php
header('Content-Type: application/json');
header('Cache-Control: no-store');

$cachePath = dirname(__DIR__) . '/data/air-traffic-cache.json';
$cacheTtlSeconds = 60;

$emit = function ($payload) {
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
};

$readCache = function () use ($cachePath) {
    if (!file_exists($cachePath)) {
        return null;
    }
    $decoded = json_decode(file_get_contents($cachePath), true);
    return is_array($decoded) ? $decoded : null;
};

$writeCache = function ($payload) use ($cachePath) {
    file_put_contents($cachePath, json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");
};

$cached = $readCache();
if ($cached && isset($cached['fetchedAt']) && (time() - intval($cached['fetchedAt'])) < $cacheTtlSeconds) {
    $emit($cached);
}

$url = 'https://opensky-network.org/api/states/all';
$context = stream_context_create([
    'http' => [
        'method' => 'GET',
        'timeout' => 15,
        'header' => "User-Agent: intel-air-tracker/1.0\r\n"
    ],
    'ssl' => [
        'verify_peer' => true,
        'verify_peer_name' => true
    ]
]);

$raw = @file_get_contents($url, false, $context);
if ($raw === false) {
    if ($cached) {
        $emit($cached + ['stale' => true]);
    }
    http_response_code(502);
    $emit(['error' => 'air_traffic_fetch_failed', 'items' => []]);
}

$decoded = json_decode($raw, true);
$states = $decoded['states'] ?? [];
$items = [];

foreach ($states as $state) {
    if (!is_array($state)) continue;

    $callsign = trim((string) ($state[1] ?? ''));
    $country = trim((string) ($state[2] ?? ''));
    $longitude = $state[5] ?? null;
    $latitude = $state[6] ?? null;
    $onGround = !empty($state[8]);
    $velocity = $state[9] ?? null;
    $heading = $state[10] ?? null;
    $altitude = $state[13] ?? ($state[7] ?? null);

    if ($latitude === null || $longitude === null || $onGround) continue;
    if ($altitude !== null && floatval($altitude) < 1000) continue;

    $items[] = [
        'icao24' => trim((string) ($state[0] ?? '')),
        'callsign' => $callsign !== '' ? $callsign : 'Unknown',
        'country' => $country,
        'lng' => floatval($longitude),
        'lat' => floatval($latitude),
        'velocity' => $velocity !== null ? round(floatval($velocity), 1) : null,
        'heading' => $heading !== null ? round(floatval($heading), 1) : null,
        'altitude' => $altitude !== null ? round(floatval($altitude), 0) : null,
        'label' => ($callsign !== '' ? $callsign : 'Unknown') . ($country !== '' ? " · {$country}" : '')
    ];

    if (count($items) >= 500) break;
}

$payload = [
    'fetchedAt' => time(),
    'source' => 'OpenSky Network',
    'count' => count($items),
    'items' => $items
];

$writeCache($payload);
$emit($payload);
