<?php
header('Content-Type: application/json');
header('Cache-Control: no-store');

$callsign = strtoupper(trim((string) ($_GET['callsign'] ?? '')));
if ($callsign === '') {
    http_response_code(400);
    echo json_encode(['error' => 'callsign_required']);
    exit;
}

$cacheDir = dirname(__DIR__) . '/data/flight-detail-cache';
if (!is_dir($cacheDir)) {
    mkdir($cacheDir, 0777, true);
}
$cachePath = $cacheDir . '/' . preg_replace('/[^A-Z0-9_-]/', '_', $callsign) . '.json';
$cacheTtlSeconds = 600;

$emit = function ($payload) {
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
};

$formatTs = function ($timestamp) {
    if (!$timestamp) return null;
    return gmdate('M j, Y g:i A', intval($timestamp)) . ' UTC';
};

$formatDuration = function ($seconds) {
    if (!$seconds) return null;
    $seconds = intval($seconds);
    $hours = intdiv($seconds, 3600);
    $minutes = intdiv($seconds % 3600, 60);
    if ($hours > 0) return $hours . 'h ' . $minutes . 'm';
    return $minutes . 'm';
};

if (file_exists($cachePath)) {
    $cached = json_decode(file_get_contents($cachePath), true);
    if (is_array($cached) && (time() - intval($cached['fetchedAt'] ?? 0)) < $cacheTtlSeconds) {
        $emit($cached);
    }
}

$url = 'https://www.flightaware.com/live/flight/' . rawurlencode($callsign);
$curl = curl_init($url);
curl_setopt_array($curl, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_TIMEOUT => 20,
    CURLOPT_USERAGENT => 'Mozilla/5.0 (Intel Flight Detail)',
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_SSL_VERIFYHOST => 2
]);
$html = curl_exec($curl);
$httpCode = intval(curl_getinfo($curl, CURLINFO_RESPONSE_CODE));
$error = curl_error($curl);
curl_close($curl);

if ($html === false || $httpCode >= 400) {
    http_response_code(502);
    $emit(['error' => 'flightaware_fetch_failed', 'callsign' => $callsign, 'httpCode' => $httpCode, 'detail' => $error]);
}

preg_match('/<title>(.*?)<\/title>/si', $html, $titleMatch);
$title = html_entity_decode(trim($titleMatch[1] ?? ''), ENT_QUOTES | ENT_HTML5);
$airline = null;
if ($title && preg_match('/\)\s+(.*?)\s+Flight Tracking/i', $title, $airlineMatch)) {
    $airline = trim($airlineMatch[1]);
}

preg_match('/trackpollBootstrap\s*=\s*(\{.*?\});/s', $html, $bootstrapMatch);
if (empty($bootstrapMatch[1])) {
    http_response_code(502);
    $emit(['error' => 'flightaware_bootstrap_missing', 'callsign' => $callsign]);
}

$bootstrap = json_decode($bootstrapMatch[1], true);
$flights = $bootstrap['flights'] ?? [];
$firstBucket = is_array($flights) ? reset($flights) : null;
$flight = $firstBucket['activityLog']['flights'][0] ?? null;

if (!is_array($flight)) {
    http_response_code(404);
    $emit(['error' => 'flight_detail_unavailable', 'callsign' => $callsign]);
}

$origin = $flight['origin'] ?? [];
$destination = $flight['destination'] ?? [];
$flightPlan = $flight['flightPlan'] ?? [];
$aircraft = $flight['aircraft'] ?? [];

$payload = [
    'fetchedAt' => time(),
    'callsign' => $callsign,
    'flightNumber' => $flight['displayIdent'] ?? $callsign,
    'airline' => $airline,
    'status' => $flight['flightStatus'] ?? null,
    'aircraftType' => $flight['aircraftTypeFriendly'] ?? ($aircraft['friendlyType'] ?? null),
    'departure' => [
        'iata' => $origin['iata'] ?? null,
        'icao' => $origin['icao'] ?? null,
        'name' => $origin['friendlyName'] ?? null,
        'location' => $origin['friendlyLocation'] ?? null,
        'terminal' => $origin['terminal'] ?? null
    ],
    'destination' => [
        'iata' => $destination['iata'] ?? null,
        'icao' => $destination['icao'] ?? null,
        'name' => $destination['friendlyName'] ?? null,
        'location' => $destination['friendlyLocation'] ?? null,
        'terminal' => $destination['terminal'] ?? null
    ],
    'times' => [
        'departureScheduled' => $formatTs($flight['gateDepartureTimes']['scheduled'] ?? $flight['takeoffTimes']['scheduled'] ?? null),
        'departureEstimated' => $formatTs($flight['gateDepartureTimes']['estimated'] ?? $flight['takeoffTimes']['estimated'] ?? null),
        'departureActual' => $formatTs($flight['gateDepartureTimes']['actual'] ?? $flight['takeoffTimes']['actual'] ?? null),
        'arrivalScheduled' => $formatTs($flight['gateArrivalTimes']['scheduled'] ?? $flight['landingTimes']['scheduled'] ?? null),
        'arrivalEstimated' => $formatTs($flight['gateArrivalTimes']['estimated'] ?? $flight['landingTimes']['estimated'] ?? null),
        'arrivalActual' => $formatTs($flight['gateArrivalTimes']['actual'] ?? $flight['landingTimes']['actual'] ?? null)
    ],
    'flightTime' => $formatDuration($flightPlan['ete'] ?? null),
    'permalink' => $flight['permaLink'] ?? null
];

file_put_contents($cachePath, json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");
$emit($payload);
