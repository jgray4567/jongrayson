<?php
header('Content-Type: application/json');
header('Cache-Control: no-store');

$path = dirname(__DIR__) . '/data/baseline-recommendation-analytics.json';
$payload = file_exists($path) ? json_decode(file_get_contents($path), true) : ['items' => []];
$items = is_array($payload['items'] ?? null) ? $payload['items'] : [];

$normalized = array_map(function ($item) {
    $acceptedCount = intval($item['acceptedCount'] ?? 0);
    $surfacedCount = intval($item['surfacedCount'] ?? 0);
    $acceptanceRate = $surfacedCount > 0 ? round($acceptedCount / $surfacedCount, 2) : 0;
    $effectiveness = 'weak';
    if ($acceptanceRate >= 0.4) $effectiveness = 'effective';
    elseif ($acceptanceRate > 0.1) $effectiveness = 'mixed';
    return [
        'action' => $item['action'] ?? 'unknown',
        'acceptedCount' => $acceptedCount,
        'surfacedCount' => $surfacedCount,
        'acceptanceRate' => $acceptanceRate,
        'effectiveness' => $effectiveness,
        'lastAcceptedAt' => $item['lastAcceptedAt'] ?? null,
        'lastSurfacedAt' => $item['lastSurfacedAt'] ?? null
    ];
}, $items);

usort($normalized, function ($a, $b) {
    return $b['acceptanceRate'] <=> $a['acceptanceRate']
        ?: $b['acceptedCount'] <=> $a['acceptedCount']
        ?: $b['surfacedCount'] <=> $a['surfacedCount'];
});

$totalAccepted = array_reduce($normalized, fn($sum, $item) => $sum + intval($item['acceptedCount'] ?? 0), 0);
$totalSurfaced = array_reduce($normalized, fn($sum, $item) => $sum + intval($item['surfacedCount'] ?? 0), 0);
$overallAcceptanceRate = $totalSurfaced > 0 ? round($totalAccepted / $totalSurfaced, 2) : 0;

echo json_encode([
    'totalAccepted' => $totalAccepted,
    'totalSurfaced' => $totalSurfaced,
    'overallAcceptanceRate' => $overallAcceptanceRate,
    'items' => $normalized
]);
