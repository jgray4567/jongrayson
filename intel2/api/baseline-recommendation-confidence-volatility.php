<?php
header('Content-Type: application/json');
header('Cache-Control: no-store');

$path = dirname(__DIR__) . '/data/baseline-recommendation-confidence-history.json';
$payload = file_exists($path) ? json_decode(file_get_contents($path), true) : ['items' => []];
$items = is_array($payload['items'] ?? null) ? $payload['items'] : [];

usort($items, function ($a, $b) {
    return intval($b['trendShiftCount'] ?? 0) <=> intval($a['trendShiftCount'] ?? 0)
        ?: abs(floatval($b['delta'] ?? 0)) <=> abs(floatval($a['delta'] ?? 0));
});

echo json_encode([
    'items' => $items,
    'highVolatilityCount' => count(array_filter($items, fn($item) => ($item['volatilityState'] ?? '') === 'high')),
    'mediumVolatilityCount' => count(array_filter($items, fn($item) => ($item['volatilityState'] ?? '') === 'medium')),
    'lowVolatilityCount' => count(array_filter($items, fn($item) => ($item['volatilityState'] ?? '') === 'low'))
]);
