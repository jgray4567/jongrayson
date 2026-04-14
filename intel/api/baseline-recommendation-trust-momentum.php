<?php
header('Content-Type: application/json');
header('Cache-Control: no-store');

$path = dirname(__DIR__) . '/data/baseline-recommendation-confidence-history.json';
$payload = file_exists($path) ? json_decode(file_get_contents($path), true) : ['items' => []];
$items = is_array($payload['items'] ?? null) ? $payload['items'] : [];

$items = array_map(function ($item) {
    $upgradedCount = intval($item['upgradedCount'] ?? 0);
    $downgradedCount = intval($item['downgradedCount'] ?? 0);
    $item['trustMomentumScore'] = intval($item['trustMomentumScore'] ?? max(-100, min(100, ($upgradedCount * 12) - ($downgradedCount * 15))));
    $item['trustMomentumBand'] = (string) ($item['trustMomentumBand'] ?? 'neutral');
    $item['trustMomentumReversalCount'] = intval($item['trustMomentumReversalCount'] ?? 0);
    $item['trustMomentumReversalStreak'] = intval($item['trustMomentumReversalStreak'] ?? 0);
    $item['trustMomentumStabilityStreak'] = intval($item['trustMomentumStabilityStreak'] ?? 0);
    $item['trustMomentumJustReversed'] = !empty($item['trustMomentumJustReversed']);
    return $item;
}, $items);

usort($items, function ($a, $b) {
    return intval($b['trustMomentumScore'] ?? 0) <=> intval($a['trustMomentumScore'] ?? 0)
        ?: strcmp((string) ($b['updatedAt'] ?? ''), (string) ($a['updatedAt'] ?? ''));
});

echo json_encode([
    'items' => $items,
    'positiveCount' => count(array_filter($items, fn($item) => ($item['trustMomentumBand'] ?? '') === 'positive')),
    'negativeCount' => count(array_filter($items, fn($item) => ($item['trustMomentumBand'] ?? '') === 'negative')),
    'neutralCount' => count(array_filter($items, fn($item) => ($item['trustMomentumBand'] ?? '') === 'neutral')),
    'reversalCount' => count(array_filter($items, fn($item) => intval($item['trustMomentumReversalCount'] ?? 0) > 0)),
    'justReversedCount' => count(array_filter($items, fn($item) => !empty($item['trustMomentumJustReversed']))),
    'streakingCount' => count(array_filter($items, fn($item) => intval($item['trustMomentumReversalStreak'] ?? 0) > 0)),
    'stableCount' => count(array_filter($items, fn($item) => intval($item['trustMomentumStabilityStreak'] ?? 0) > 0))
]);
