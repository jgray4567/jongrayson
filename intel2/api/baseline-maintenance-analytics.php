<?php
header('Content-Type: application/json');
header('Cache-Control: no-store');

$path = dirname(__DIR__) . '/data/baseline-maintenance-analytics.json';
$payload = file_exists($path) ? json_decode(file_get_contents($path), true) : ['items' => []];
$items = is_array($payload['items'] ?? null) ? $payload['items'] : [];

usort($items, function ($a, $b) {
    return intval($b['count'] ?? 0) <=> intval($a['count'] ?? 0)
        ?: strcmp((string) ($b['lastRunAt'] ?? ''), (string) ($a['lastRunAt'] ?? ''));
});

$totalRuns = array_reduce($items, function ($sum, $item) {
    return $sum + intval($item['count'] ?? 0);
}, 0);

echo json_encode([
    'totalRuns' => $totalRuns,
    'items' => $items
]);
