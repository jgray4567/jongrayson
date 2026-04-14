<?php
header('Content-Type: application/json');
header('Cache-Control: no-store');

$path = dirname(__DIR__) . '/data/baseline-maintenance-analytics.json';
$payload = file_exists($path) ? json_decode(file_get_contents($path), true) : ['items' => []];
$items = is_array($payload['items'] ?? null) ? $payload['items'] : [];

$normalized = array_map(function ($item) {
    $count = intval($item['count'] ?? 0);
    $totalRemoved = intval($item['totalRemoved'] ?? 0);
    $avgRemoved = $count > 0 ? round($totalRemoved / $count, 2) : 0;
    $effectiveness = 'weak';
    if ($avgRemoved >= 1) $effectiveness = 'effective';
    elseif ($avgRemoved > 0) $effectiveness = 'mixed';
    return [
        'action' => $item['action'] ?? 'unknown',
        'count' => $count,
        'totalRemoved' => $totalRemoved,
        'avgRemoved' => $avgRemoved,
        'lastRemovedCount' => intval($item['lastRemovedCount'] ?? 0),
        'lastRunAt' => $item['lastRunAt'] ?? null,
        'effectiveness' => $effectiveness
    ];
}, $items);

usort($normalized, function ($a, $b) {
    return $b['totalRemoved'] <=> $a['totalRemoved']
        ?: $b['count'] <=> $a['count']
        ?: strcmp((string) ($b['lastRunAt'] ?? ''), (string) ($a['lastRunAt'] ?? ''));
});

$totalRuns = array_reduce($normalized, fn($sum, $item) => $sum + intval($item['count'] ?? 0), 0);
$totalRemoved = array_reduce($normalized, fn($sum, $item) => $sum + intval($item['totalRemoved'] ?? 0), 0);
$effectiveCount = count(array_filter($normalized, fn($item) => ($item['effectiveness'] ?? '') === 'effective'));
$mixedCount = count(array_filter($normalized, fn($item) => ($item['effectiveness'] ?? '') === 'mixed'));
$weakCount = count(array_filter($normalized, fn($item) => ($item['effectiveness'] ?? '') === 'weak'));

echo json_encode([
    'totalRuns' => $totalRuns,
    'totalRemoved' => $totalRemoved,
    'effectiveCount' => $effectiveCount,
    'mixedCount' => $mixedCount,
    'weakCount' => $weakCount,
    'items' => $normalized
]);
