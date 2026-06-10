<?php
header('Content-Type: application/json');
header('Cache-Control: no-store');

$path = dirname(__DIR__) . '/data/intel-analytics.json';
$payload = file_exists($path) ? json_decode(file_get_contents($path), true) : ['items' => []];
$items = array_values(array_filter($payload['items'] ?? [], function ($item) {
    return intval($item['thirdOrderEscalationAcceptCount'] ?? 0) > 0;
}));

usort($items, function ($a, $b) {
    $countCompare = intval($b['thirdOrderEscalationAcceptCount'] ?? 0) <=> intval($a['thirdOrderEscalationAcceptCount'] ?? 0);
    if ($countCompare !== 0) return $countCompare;
    return strcmp(($b['lastThirdOrderAcceptedAt'] ?? ''), ($a['lastThirdOrderAcceptedAt'] ?? ''));
});

echo json_encode(['items' => $items]);
