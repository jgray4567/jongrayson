<?php
header('Content-Type: application/json');
header('Cache-Control: no-store');

$cachePath = __DIR__ . '/../data/satellite-tracker-cache.json';
$cacheTtlSeconds = 1800;
$maxItems = 500;
$groups = [
    ['slug' => 'stations', 'network' => 'Crewed / Stations', 'limit' => 20],
    ['slug' => 'starlink', 'network' => 'SpaceX Starlink', 'limit' => 120, 'query' => 'NAME=starlink'],
    ['slug' => 'oneweb', 'network' => 'OneWeb', 'limit' => 50],
    ['slug' => 'gps-ops', 'network' => 'GPS', 'limit' => 35],
    ['slug' => 'galileo', 'network' => 'Galileo', 'limit' => 35],
    ['slug' => 'iridium', 'network' => 'Iridium', 'limit' => 40],
    ['slug' => 'geo', 'network' => 'GEO Comms', 'limit' => 40]
];

$emit = function ($payload) {
    // Deliberately does NOT touch the lock: this is also called by requests
    // that never took one (fresh cache, or serving stale while another
    // request refreshes). Releasing here would hand away a live lock.
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
        CURLOPT_TIMEOUT => 8,   // was 30; see the budget note below
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
$bypassCache = isset($_GET['nocache']) || isset($_GET['refresh']);
if (!$bypassCache && $cached && isset($cached['fetchedAt']) && (time() - intval($cached['fetchedAt'])) < $cacheTtlSeconds) {
    $emit($cached);
}

/*
 * Worker protection.
 *
 * This endpoint walks SEVEN CelesTrak groups sequentially. At the previous
 * 30s per-request timeout a single cache miss could hold one PHP worker for
 * up to 3.5 minutes, and on this shared host a couple of those starve the
 * pool for everything else — including endpoints that only read a local file.
 * That is what took the dashboard down.
 *
 * Three guards, in order of importance:
 *   1. Single flight — only one request at a time may refresh. Everyone else
 *      is served the stale cache immediately, flagged.
 *   2. Wall-clock budget — stop fetching further groups once the budget is
 *      spent and fall back to cached entries for the rest, so the request can
 *      never run long no matter how slow CelesTrak is.
 *   3. Per-request timeout cut from 30s to 8s.
 */
$lockPath = $cachePath . '.lock';
$lockHeld = file_exists($lockPath) && (time() - filemtime($lockPath)) < 180;
if (!$bypassCache && $lockHeld && $cached) {
    $cached['stale'] = true;
    $cached['note'] = 'refresh in progress; serving last good element sets';
    $emit($cached);
}
@touch($lockPath);
$fetchBudgetUntil = microtime(true) + 25.0;   // hard ceiling for the whole walk

$mu = 398600.4418;
$earthRadiusKm = 6378.137;
$items = [];
$errors = [];

foreach ($groups as $group) {
    // Budget spent: reuse whatever this group had in cache rather than
    // continuing to fetch. Partial-but-fast beats complete-but-hung.
    if (microtime(true) > $fetchBudgetUntil) {
        $errors[] = $group['slug'] . ': skipped (time budget)';
        if ($cached && isset($cached['items'])) {
            $prev = array_filter($cached['items'], fn($i) => ($i['network'] ?? '') === $group['network']);
            if ($prev) $items = array_merge($items, array_slice(array_values($prev), 0, intval($group['limit'])));
        }
        continue;
    }
    $url = isset($group['query'])
        ? 'https://celestrak.org/NORAD/elements/gp.php?' . $group['query'] . '&FORMAT=tle'
        : 'https://celestrak.org/NORAD/elements/gp.php?GROUP=' . rawurlencode($group['slug']) . '&FORMAT=tle';
    [$raw, $httpCode, $error] = $fetch($url);

    // CelesTrak returns 403 for rate-limited groups — fall back to seed file for Starlink
    if ($httpCode === 403) {
        $seedPath = __DIR__ . '/../data/starlink-seed.json';
        if ($group['slug'] === 'starlink' && file_exists($seedPath)) {
            $seedData = json_decode(file_get_contents($seedPath), true);
            if (is_array($seedData) && isset($seedData['items'])) {
                $seedItems = array_slice($seedData['items'], 0, intval($group['limit']));
                $items = array_merge($items, $seedItems);
                continue;
            }
        }
        // Try cached data for other 403 groups
        if ($cached && isset($cached['items'])) {
            $cachedGroupItems = array_filter($cached['items'], fn($i) => $i['network'] === $group['network']);
            if (count($cachedGroupItems) > 0) {
                $items = array_merge($items, array_slice(array_values($cachedGroupItems), 0, intval($group['limit'])));
                continue;
            }
        }
    }
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
        @unlink($lockPath);          // we own it on this path
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
@unlink($lockPath);
$emit($payload);
