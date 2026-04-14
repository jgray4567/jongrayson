<?php
header('Content-Type: application/json');
header('Cache-Control: no-store');

$path = dirname(__DIR__) . '/data/baseline-recommendation-analytics.json';
$payload = file_exists($path) ? json_decode(file_get_contents($path), true) : ['items' => []];
$items = is_array($payload['items'] ?? null) ? $payload['items'] : [];

usort($items, function ($a, $b) {
    return intval($b['acceptedCount'] ?? 0) <=> intval($a['acceptedCount'] ?? 0)
        ?: intval($b['surfacedCount'] ?? 0) <=> intval($a['surfacedCount'] ?? 0)
        ?: strcmp((string) ($b['lastAcceptedAt'] ?? ''), (string) ($a['lastAcceptedAt'] ?? ''));
});

echo json_encode(['items' => $items]);
