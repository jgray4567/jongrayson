<?php
header('Content-Type: application/json');
header('Cache-Control: no-store');

$cachePath = dirname(__DIR__) . '/data/satellite-tracker-cache.json';
$cacheTtlSeconds = 1800;
$maxItems = 400;
$groups = [
    ['slug' => 'stations', 'network' => 'Crewed / Stations', 'limit' => 20],
    ['slug' => 'starlink', 'network' => 'SpaceX Starlink', 'limit' => 120],
    ['slug' => 'oneweb', 'network' => 'OneWeb', 'limit' => 50],
    ['slug' => 'gps-ops', 'network' => 'GPS', 'limit' => 35],
    ['slug' => 'galileo', 'network' => 'Galileo', 'limit' => 35],
    ['slug' => 'iridium', 'network' => 'Iridium', 'limit' => 40],
    ['slug' => 'geo', 'network' => 'GEO Comms', 'limit' => 40]
];

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
    file_put_contents($cachePath, json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");
};

$orbitClassForAltitude = function ($altitudeKm) {
    if ($altitudeKm >= 35000) return 'GEO';
    if ($altitudeKm >= 2000) return 'MEO';
    return 'LEO';
};

$fetch = function ($url) {
    $curl = curl_init($url);
    curl_setopt_array($curl, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_USERAGENT => 'Mozilla/5.0 (Intel Satellite Tracker)',
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2
    ]);
    $body = curl_exec($curl);
    $error = curl_error($curl);
    $httpCode = intval(curl_getinfo($curl, CURLINFO_RESPONSE_CODE));
    curl_close($curl);
    return [$body, $httpCode, $error];
};

$cached = $readCache();
if ($cached && isset($cached['fetchedAt']) && (time() - intval($cached['fetchedAt'])) < $cacheTtlSeconds) {
    $emit($cached);
}

$mu = 398600.4418;
$earthRadiusKm = 6378.137;
$items = [];
$errors = [];

foreach ($groups as $group) {
    $url = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=' . rawurlencode($group['slug']) . '&FORMAT=tle';
    [$raw, $httpCode, $error] = $fetch($url);

    if ($raw === false || $httpCode >= 400 || trim((string) $raw) === '') {
        $errors[] = [
            'group' => $group['slug'],
            'httpCode' => $httpCode,
            'error' => $error !== '' ? $error : 'fetch_failed'
        ];
        continue;
    }

    $lines = preg_split('/\r?\n/', trim($raw));
    $groupCount = 0;

    for ($i = 0; $i + 2 < count($lines); $i += 3) {
        $name = trim($lines[$i] ?? '');
        $tle1 = trim($lines[$i + 1] ?? '');
        $tle2 = trim($lines[$i + 2] ?? '');

        if ($name === '' || strpos($tle1, '1 ') !== 0 || strpos($tle2, '2 ') !== 0) {
            continue;
        }

        $inclination = floatval(trim(substr($tle2, 8, 8)) ?: '0');
        $meanMotion = floatval(trim(substr($tle2, 52, 11)) ?: '0');
        if ($meanMotion <= 0) continue;

        $periodMinutes = 1440 / $meanMotion;
        $meanMotionRadPerSec = $meanMotion * 2 * M_PI / 86400;
        $semiMajorAxisKm = pow($mu / pow($meanMotionRadPerSec, 2), 1 / 3);
        $altitudeKm = max(0, $semiMajorAxisKm - $earthRadiusKm);

        $items[] = [
            'name' => $name,
            'network' => $group['network'],
            'orbitClass' => $orbitClassForAltitude($altitudeKm),
            'inclination' => round($inclination, 1),
            'periodMinutes' => round($periodMinutes, 1),
            'altitudeKm' => round($altitudeKm, 0),
            'noradId' => trim(substr($tle1, 2, 5)),
            'tle1' => $tle1,
            'tle2' => $tle2
        ];

        $groupCount += 1;
        if ($groupCount >= intval($group['limit']) || count($items) >= $maxItems) {
            break;
        }
    }

    if (count($items) >= $maxItems) {
        break;
    }
}

if (!$items) {
    if ($cached) {
        $cached['stale'] = true;
        $cached['errors'] = $errors;
        $emit($cached);
    }
    http_response_code(502);
    $emit(['error' => 'satellite_catalog_fetch_failed', 'errors' => $errors, 'items' => []]);
}

$payload = [
    'fetchedAt' => time(),
    'source' => 'CelesTrak public TLE groups',
    'count' => count($items),
    'items' => $items,
    'errors' => $errors
];

$writeCache($payload);
$emit($payload);
