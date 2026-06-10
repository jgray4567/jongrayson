<?php
header('Content-Type: application/json');
header('Cache-Control: no-store');

$path = dirname(__DIR__) . '/data/baseline-recommendation-churn.json';
$payload = file_exists($path) ? json_decode(file_get_contents($path), true) : ['items' => []];
$items = is_array($payload['items'] ?? null) ? $payload['items'] : [];

usort($items, function ($a, $b) {
    return intval($b['changeCount'] ?? 0) <=> intval($a['changeCount'] ?? 0)
        ?: strcmp((string) ($b['lastChangedAt'] ?? ''), (string) ($a['lastChangedAt'] ?? ''));
});

echo json_encode([
    'items' => $items,
    'highChurnCount' => count(array_filter($items, fn($item) => intval($item['changeCount'] ?? 0) >= 3)),
    'totalTracked' => count($items)
]);
