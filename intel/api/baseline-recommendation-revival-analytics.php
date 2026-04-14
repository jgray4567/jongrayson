<?php
header('Content-Type: application/json');
header('Cache-Control: no-store');

$path = dirname(__DIR__) . '/data/baseline-recommendation-revivals.json';
$payload = file_exists($path) ? json_decode(file_get_contents($path), true) : ['items' => []];
$items = is_array($payload['items'] ?? null) ? $payload['items'] : [];

usort($items, function ($a, $b) {
    return strcmp((string) ($b['revivedAt'] ?? ''), (string) ($a['revivedAt'] ?? ''));
});

echo json_encode([
    'items' => $items,
    'activeCount' => count(array_filter($items, fn($item) => ($item['status'] ?? '') === 'active')),
    'stickingCount' => count(array_filter($items, fn($item) => ($item['status'] ?? '') === 'sticking')),
    'failedCount' => count(array_filter($items, fn($item) => ($item['status'] ?? '') === 'failed'))
]);
