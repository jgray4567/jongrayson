<?php
header('Content-Type: application/json');
header('Cache-Control: no-store');

$path = dirname(__DIR__) . '/data/baseline-recommendation-confidence-history.json';
$payload = file_exists($path) ? json_decode(file_get_contents($path), true) : ['items' => []];
$items = is_array($payload['items'] ?? null) ? $payload['items'] : [];

usort($items, function ($a, $b) {
    return abs(floatval($b['delta'] ?? 0)) <=> abs(floatval($a['delta'] ?? 0))
        ?: strcmp((string) ($b['updatedAt'] ?? ''), (string) ($a['updatedAt'] ?? ''));
});

echo json_encode([
    'items' => $items,
    'risingCount' => count(array_filter($items, fn($item) => ($item['trend'] ?? '') === 'rising')),
    'fallingCount' => count(array_filter($items, fn($item) => ($item['trend'] ?? '') === 'falling')),
    'steadyCount' => count(array_filter($items, fn($item) => ($item['trend'] ?? '') === 'steady'))
]);
