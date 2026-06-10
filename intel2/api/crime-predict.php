<?php
header('Content-Type: application/json');
header('Cache-Control: no-store');

$dataDir = dirname(__DIR__) . '/data/pittsburgh';
$cachePath = $dataDir . '/predicted_danger_zones.json';
$cacheTtl = 1800; // 30 min — predictions refresh every half hour

// Serve cached if fresh
if (file_exists($cachePath)) {
    $cached = json_decode(file_get_contents($cachePath), true);
    if (is_array($cached) && (time() - intval($cached['generatedAtEpoch'] ?? 0)) < $cacheTtl) {
        echo json_encode($cached, JSON_UNESCAPED_SLASHES);
        exit;
    }
}

// Run the Python predictor
$python = trim(shell_exec('which python3') ?: '');
if (!$python) $python = '/usr/bin/python3';

$script = dirname(__DIR__) . '/api/crime-predict.py';
$input = $dataDir . '/daily_crimes.json';
$output = $dataDir . '/predicted_danger_zones.json';

exec("$python $script $input $output 2>&1", $outputLines, $exitCode);

if ($exitCode !== 0 || !file_exists($cachePath)) {
    http_response_code(500);
    echo json_encode(['error' => 'prediction_failed', 'detail' => implode("\n", $outputLines)]);
    exit;
}

$result = json_decode(file_get_contents($cachePath), true);
if (!is_array($result)) {
    http_response_code(500);
    echo json_encode(['error' => 'invalid_output']);
    exit;
}

// Add epoch for cache checking
$result['generatedAtEpoch'] = time();
file_put_contents($cachePath, json_encode($result, JSON_UNESCAPED_SLASHES));

echo json_encode($result, JSON_UNESCAPED_SLASHES);