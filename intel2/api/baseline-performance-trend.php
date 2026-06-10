<?php
header('Content-Type: application/json');
header('Cache-Control: no-store');

$path = dirname(__DIR__) . '/data/baseline-history.json';
$payload = file_exists($path) ? json_decode(file_get_contents($path), true) : ['items' => []];
$items = is_array($payload['items'] ?? null) ? $payload['items'] : [];

usort($items, function ($a, $b) {
    return strcmp((string) ($b['recordedAt'] ?? ''), (string) ($a['recordedAt'] ?? ''));
});

$recent = array_slice($items, 0, 5);
$prior = array_slice($items, 5, 5);

$avg = function ($entries) {
    $count = count($entries);
    if ($count === 0) return 0;
    $sum = array_reduce($entries, function ($carry, $item) {
        return $carry + intval($item['score'] ?? 0);
    }, 0);
    return round($sum / $count, 2);
};

$recentAvg = $avg($recent);
$priorAvg = $avg($prior);
$drift = round($recentAvg - $priorAvg, 2);
$trend = 'steady';
if ($drift >= 1) $trend = 'hotter';
elseif ($drift <= -1) $trend = 'cooler';

$latestLabel = count($recent) > 0 ? ($recent[0]['label'] ?? 'n/a') : 'n/a';

echo json_encode([
    'recentCount' => count($recent),
    'priorCount' => count($prior),
    'recentAverageScore' => $recentAvg,
    'priorAverageScore' => $priorAvg,
    'drift' => $drift,
    'trend' => $trend,
    'latestLabel' => $latestLabel
]);
