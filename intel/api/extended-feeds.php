<?php
/**
 * extended-feeds.php — Extended data feeds for Intel Globe v2
 *
 * Sources:
 *   ?source=fires  — NASA FIRMS VIIRS active fire detections (CSV → JSON)
 *   ?source=ships  — MarineTraffic public map scrape (fallback for AIS WebSocket)
 *
 * Caching:
 *   fires: 30 min TTL  (data dir: ../data/fires-cache.json)
 *   ships:  2 min TTL  (data dir: ../data/ships-cache.json)
 */

error_reporting(E_ERROR | E_PARSE);
ini_set('display_errors', '0');

// ── CORS ──────────────────────────────────────────────────────
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Requested-With');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ── Data directory ─────────────────────────────────────────────
$dataDir = dirname(__DIR__) . '/data';
if (!is_dir($dataDir)) {
    @mkdir($dataDir, 0755, true);
}

$source = isset($_GET['source']) ? trim($_GET['source']) : '';

// ── Helpers ────────────────────────────────────────────────────
$emit = function ($payload, $httpCode = 200) {
    http_response_code($httpCode);
    header('Content-Type: application/json');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
};

$readCache = function ($path, $ttl) {
    if (!file_exists($path)) return null;
    $raw = file_get_contents($path);
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) return null;
    if (!isset($decoded['fetchedAt']) || (time() - intval($decoded['fetchedAt'])) > $ttl) return null;
    return $decoded;
};

$writeCache = function ($path, $payload) {
    file_put_contents($path, json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n");
};

$httpGet = function ($url, $timeout = 20) {
    $ctx = stream_context_create([
        'http' => [
            'method'  => 'GET',
            'timeout' => $timeout,
            'header'  => "User-Agent: intel-globe-ext/1.0\r\nAccept: */*\r\n",
        ],
        'ssl' => [
            'verify_peer'      => true,
            'verify_peer_name' => true,
        ],
    ]);
    return @file_get_contents($url, false, $ctx);
};

// ══════════════════════════════════════════════════════════════
//  ?source=fires — NASA FIRMS VIIRS active fires (global, 24h)
// ══════════════════════════════════════════════════════════════
if ($source === 'fires') {

    $cachePath = $dataDir . '/fires-cache.json';
    $cacheTtl  = 1800; // 30 minutes

    // Serve from cache if fresh
    $cached = $readCache($cachePath, $cacheTtl);
    if ($cached) {
        $cached['cached'] = true;
        $emit($cached);
    }

    // NASA FIRMS API with MAP_KEY
    $MAP_KEY = 'bba043d5a1402bf3b501806ebb5bbfa5';

    // Try VIIRS SNPP NRT first (most reliable), then NOAA-20, then MODIS
    $fireUrls = [
        "https://firms.modaps.eosdis.nasa.gov/api/area/csv/{$MAP_KEY}/VIIRS_SNPP_NRT/-180,-90,180,90/2",
        "https://firms.modaps.eosdis.nasa.gov/api/area/csv/{$MAP_KEY}/VIIRS_NOAA20_NRT/-180,-90,180,90/2",
        "https://firms.modaps.eosdis.nasa.gov/api/area/csv/{$MAP_KEY}/MODIS_NRT/-180,-90,180,90/2",
    ];

    $raw = false;
    foreach ($fireUrls as $url) {
        $raw = $httpGet($url, 25);
        if ($raw !== false && strlen($raw) > 50 && stripos($raw, 'Invalid') === false) break;
        $raw = false;
    }

    if ($raw === false || strlen($raw) < 50) {
        // Return stale cache if available
        if (file_exists($cachePath)) {
            $stale = json_decode(file_get_contents($cachePath), true);
            if (is_array($stale)) {
                $stale['stale'] = true;
                $stale['cached'] = true;
                $emit($stale);
            }
        }
        $emit(['error' => 'fires_fetch_failed', 'items' => [], 'count' => 0], 502);
    }

    // Parse CSV
    $lines = explode("\n", trim($raw));
    if (count($lines) < 2) {
        $emit(['error' => 'fires_parse_empty', 'items' => [], 'count' => 0], 502);
    }

    // Header row
    $header = str_getcsv(array_shift($lines));
    $headerMap = array_flip(array_map('strtolower', $header));

    $colLat   = isset($headerMap['latitude'])  ? $headerMap['latitude']  : 0;
    $colLng   = isset($headerMap['longitude']) ? $headerMap['longitude'] : 1;
    $colBright = isset($headerMap['bright_ti4']) ? $headerMap['bright_ti4']
               : (isset($headerMap['brightness']) ? $headerMap['brightness'] : 2);
    $colConf  = isset($headerMap['confidence']) ? $headerMap['confidence'] : null;
    $colFrp   = isset($headerMap['frp'])        ? $headerMap['frp']        : null;
    $colDate  = isset($headerMap['acq_date'])   ? $headerMap['acq_date']   : null;
    $colTime  = isset($headerMap['acq_time'])   ? $headerMap['acq_time']   : null;
    $colSat   = isset($headerMap['satellite'])  ? $headerMap['satellite']  : null;
    $colScan  = isset($headerMap['scan'])       ? $headerMap['scan']       : null;
    $colTrack = isset($headerMap['track'])      ? $headerMap['track']      : null;

    $fires = [];
    $maxFires = 5000;

    foreach ($lines as $line) {
        if (count($fires) >= $maxFires) break;
        $row = str_getcsv($line);
        if (count($row) < 3) continue;

        $lat = isset($row[$colLat]) ? floatval($row[$colLat]) : null;
        $lng = isset($row[$colLng]) ? floatval($row[$colLng]) : null;
        if ($lat === null || $lng === null) continue;
        if ($lat < -90 || $lat > 90 || $lng < -180 || $lng > 180) continue;

        $brightness = isset($row[$colBright]) ? floatval($row[$colBright]) : 0;
        $confidence = $colConf !== null ? trim($row[$colConf]) : 'n';
        $frp        = $colFrp !== null ? floatval($row[$colFrp]) : 0;
        $acqDate    = $colDate !== null ? trim($row[$colDate]) : '';
        $acqTime    = $colTime !== null ? trim($row[$colTime]) : '';
        $satellite  = $colSat !== null ? trim($row[$colSat]) : '';
        $scan       = $colScan !== null ? floatval($row[$colScan]) : 1;
        $track      = $colTrack !== null ? floatval($row[$colTrack]) : 1;

        $acqTimestamp = '';
        if ($acqDate && $acqTime) {
            $timeStr = str_pad($acqTime, 6, '0', STR_PAD_LEFT);
            $h = substr($timeStr, 0, 2);
            $m = substr($timeStr, 2, 2);
            $s = substr($timeStr, 4, 2);
            $acqTimestamp = "{$acqDate}T{$h}:{$m}:{$s}Z";
        }

        $fires[] = [
            'lat'         => $lat,
            'lng'         => $lng,
            'brightness'  => $brightness,
            'confidence'  => $confidence,
            'frp'         => round($frp, 2),
            'acq_date'    => $acqDate,
            'acq_time'    => $acqTime,
            'acq_timestamp' => $acqTimestamp,
            'satellite'   => $satellite,
            'scan'        => $scan,
            'track'       => $track,
        ];
    }

    $payload = [
        'source'     => 'nasa-firms-viirs',
        'fetchedAt'  => time(),
        'count'      => count($fires),
        'items'      => $fires,
    ];

    $writeCache($cachePath, $payload);
    $payload['cached'] = false;
    $emit($payload);
}

// ══════════════════════════════════════════════════════════════
//  ?source=ships — MarineTraffic public map scrape (REST fallback)
// ══════════════════════════════════════════════════════════════
if ($source === 'ships') {

    $cachePath = $dataDir . '/ships-cache.json';
    $cacheTtl  = 120; // 2 minutes

    $cached = $readCache($cachePath, $cacheTtl);
    if ($cached) {
        $cached['cached'] = true;
        $emit($cached);
    }

    $mtUrl = 'https://www.marinetraffic.com/en/ais/get-fleet-json/get_positions';
    $mtParams = http_build_query([
        'asset_type'   => 'vessel',
        'sw_lat'       => '-90',
        'sw_lon'       => '-180',
        'ne_lat'       => '90',
        'ne_lon'       => '180',
        'zoom'         => '3',
        'fleet_types'  => '',
        'time_stamp'   => time(),
    ]);

    $mtHeaders = [
        "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept: application/json, text/javascript, */*; q=0.01",
        "Accept-Language: en-US,en;q=0.9",
        "Referer: https://www.marinetraffic.com/",
        "X-Requested-With: XMLHttpRequest",
    ];

    $ctx = stream_context_create([
        'http' => [
            'method'  => 'GET',
            'timeout' => 15,
            'header'  => implode("\r\n", $mtHeaders),
        ],
        'ssl' => [
            'verify_peer'      => true,
            'verify_peer_name' => true,
        ],
    ]);

    $raw = @file_get_contents($mtUrl . '?' . $mtParams, false, $ctx);

    $ships = [];

    if ($raw !== false) {
        $decoded = json_decode($raw, true);
        if (is_array($decoded)) {
            $rows = $decoded['data']['rows'] ?? $decoded['rows'] ?? $decoded['data'] ?? [];
            if (is_array($rows)) {
                $maxShips = 3000;
                foreach ($rows as $row) {
                    if (count($ships) >= $maxShips) break;
                    $lat = $row['LAT'] ?? $row['lat'] ?? null;
                    $lng = $row['LON'] ?? $row['lon'] ?? $row['lng'] ?? null;
                    if ($lat === null || $lng === null) continue;
                    $mmsi     = $row['MMSI']     ?? $row['mmsi']     ?? '';
                    $speed    = $row['SPEED']    ?? $row['speed']    ?? 0;
                    $heading  = $row['HEADING']  ?? $row['heading']  ?? 0;
                    $shipType = $row['SHIP_TYPE']?? $row['shipType'] ?? $row['TYPE'] ?? 'Unknown';
                    $dest     = $row['DESTINATION'] ?? $row['destination'] ?? '';
                    $name     = $row['SHIPNAME'] ?? $row['name']    ?? '';
                    $ts       = $row['TIMESTAMP'] ?? $row['timestamp'] ?? '';
                    $typeStr = is_numeric($shipType) ? shipTypeCodeToString(intval($shipType)) : trim($shipType);
                    $ships[] = [
                        'mmsi'      => trim((string)$mmsi),
                        'name'      => trim((string)$name),
                        'lat'       => floatval($lat),
                        'lng'       => floatval($lng),
                        'speed'     => floatval($speed),
                        'heading'   => floatval($heading),
                        'shipType'  => $typeStr,
                        'destination' => trim((string)$dest),
                        'timestamp' => trim((string)$ts),
                    ];
                }
            }
        }
    }

    if (empty($ships)) {
        if (file_exists($cachePath)) {
            $stale = json_decode(file_get_contents($cachePath), true);
            if (is_array($stale) && !empty($stale['items'])) {
                $stale['stale'] = true;
                $stale['cached'] = true;
                $emit($stale);
            }
        }

        $shippingLanes = [
            [35.9, 14.0, 'Suez Canal', 'Cargo', 305],
            [24.8, 57.8, 'Fujairah', 'Tanker', 340],
            [26.6, 56.2, 'Jebel Ali', 'Cargo', 285],
            [1.3, 103.5, 'Singapore', 'Cargo', 75],
            [34.0, -130.0, 'Los Angeles', 'Cargo', 85],
            [36.0, -75.0, 'Norfolk', 'Cargo', 180],
            [25.0, -80.0, 'Miami', 'Passenger', 45],
            [50.0, -5.0, 'English Channel', 'Tanker', 90],
            [40.0, -25.0, 'Atlantic', 'Cargo', 270],
            [35.0, 140.0, 'Tokyo', 'Cargo', 270],
            [-34.0, 18.0, 'Cape Town', 'Tanker', 180],
            [55.0, 12.0, 'Baltic Sea', 'Tanker', 45],
            [60.0, 5.0, 'Bergen', 'Passenger', 0],
            [28.0, -90.0, 'Gulf of Mexico', 'Tanker', 315],
            [13.5, 43.0, 'Bab-el-Mandeb', 'Cargo', 180],
            [-6.0, 105.0, 'Sunda Strait', 'Cargo', 90],
            [49.0, -125.0, 'Vancouver', 'Cargo', 180],
            [20.0, -160.0, 'Pacific', 'Fishing', 90],
            [38.0, 125.0, 'Yellow Sea', 'Cargo', 180],
            [72.0, 20.0, 'Norwegian Sea', 'Cargo', 90],
        ];

        $typeNames = ['Cargo', 'Tanker', 'Passenger', 'Fishing', 'Military'];
        $dests = ['Rotterdam', 'Singapore', 'Shanghai', 'Houston', 'Suez', 'Panama', 'Hamburg', 'Busan'];

        for ($i = 0; $i < 120; $i++) {
            $lane = $shippingLanes[$i % count($shippingLanes)];
            $jitterLat = (lcg_value() - 0.5) * 2.0;
            $jitterLng = (lcg_value() - 0.5) * 2.0;
            $ships[] = [
                'mmsi'      => 'SIM' . str_pad((string)(100000 + $i), 6, '0', STR_PAD_LEFT),
                'name'      => 'Vessel ' . substr(md5((string)$i), 0, 6),
                'lat'       => round($lane[0] + $jitterLat, 4),
                'lng'       => round($lane[1] + $jitterLng, 4),
                'speed'     => rand(8, 22) + (lcg_value() * 3),
                'heading'   => fmod($lane[4] + (lcg_value() - 0.5) * 40 + 360, 360),
                'shipType'  => $typeNames[array_rand($typeNames)],
                'destination' => $dests[array_rand($dests)],
                'timestamp' => gmdate('Y-m-d\TH:i:s\Z'),
            ];
        }

        $payload = [
            'source'    => 'synthetic-fallback',
            'fetchedAt' => time(),
            'count'     => count($ships),
            'items'     => $ships,
            'note'      => 'MarineTraffic scrape failed — showing synthetic coastal traffic',
        ];
    } else {
        $payload = [
            'source'    => 'marinetraffic',
            'fetchedAt' => time(),
            'count'     => count($ships),
            'items'     => $ships,
        ];
    }

    $writeCache($cachePath, $payload);
    $payload['cached'] = false;
    $emit($payload);
}

function shipTypeCodeToString($code) {
    $map = [
        0  => 'Unknown', 20 => 'Wing in ground', 30 => 'Fishing',
        31 => 'Towing', 32 => 'Towing (large)', 33 => 'Dredging',
        34 => 'Diving', 35 => 'Military', 36 => 'Sailing',
        37 => 'Pleasure Craft', 40 => 'High-speed craft',
        50 => 'Pilot Vessel', 51 => 'Search and Rescue', 52 => 'Tug',
        53 => 'Port Tender', 54 => 'Anti-pollution', 55 => 'Law Enforcement',
        58 => 'Medical Transport', 59 => 'Noncombatant',
        60 => 'Passenger', 70 => 'Cargo', 80 => 'Tanker', 90 => 'Other',
    ];
    $best = 'Unknown';
    foreach ($map as $k => $v) { if ($code >= $k) $best = $v; }
    return $best;
}

$emit(['error' => 'unknown_source', 'message' => 'Use ?source=fires or ?source=ships'], 400);
