<?php
header('Content-Type: application/json');
header('Cache-Control: no-store');

$path = dirname(__DIR__) . '/data/baseline-history.json';
$payload = file_exists($path) ? json_decode(file_get_contents($path), true) : ['items' => []];
$items = is_array($payload['items'] ?? null) ? $payload['items'] : [];

$total = count($items);
$scoreSum = array_reduce($items, function ($sum, $item) {
    return $sum + intval($item['score'] ?? 0);
}, 0);

$summary = [
    'totalComparisons' => $total,
    'averageScore' => $total > 0 ? round($scoreSum / $total, 2) : 0,
    'escalatingCount' => count(array_filter($items, fn($item) => ($item['label'] ?? '') === 'Escalating')),
    'steadyCount' => count(array_filter($items, fn($item) => ($item['label'] ?? '') === 'Steady')),
    'coolingCount' => count(array_filter($items, fn($item) => ($item['label'] ?? '') === 'Cooling')),
    'savedBaselineCount' => count(array_filter($items, fn($item) => ($item['baselineMode'] ?? 'previous') === 'saved')),
    'previousBaselineCount' => count(array_filter($items, fn($item) => ($item['baselineMode'] ?? 'previous') !== 'saved')),
    'topBaselineLabel' => 'n/a'
];

if ($summary['escalatingCount'] >= $summary['steadyCount'] && $summary['escalatingCount'] >= $summary['coolingCount'] && $summary['escalatingCount'] > 0) {
    $summary['topBaselineLabel'] = 'Escalating';
} elseif ($summary['coolingCount'] >= $summary['steadyCount'] && $summary['coolingCount'] > 0) {
    $summary['topBaselineLabel'] = 'Cooling';
} elseif ($summary['steadyCount'] > 0) {
    $summary['topBaselineLabel'] = 'Steady';
}

echo json_encode($summary);
