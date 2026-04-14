<?php
header('Content-Type: application/json');
header('Cache-Control: no-store');

$path = dirname(__DIR__) . '/data/intel-analytics.json';
$payload = file_exists($path) ? json_decode(file_get_contents($path), true) : ['items' => []];
$items = array_values(array_filter($payload['items'] ?? [], function ($item) {
    return ($item['effectiveness'] ?? 'weak') !== 'effective';
}));

usort($items, function ($a, $b) {
    return strcmp(($a['effectiveness'] ?? ''), ($b['effectiveness'] ?? '')) ?: strcmp(($a['topic'] ?? ''), ($b['topic'] ?? ''));
});

echo json_encode(['items' => $items]);
