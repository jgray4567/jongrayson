<?php
header('Content-Type: application/json');
header('Cache-Control: no-store');

$outcomesPath = dirname(__DIR__) . '/data/baseline-recommendation-outcomes.json';
$analyticsPath = dirname(__DIR__) . '/data/baseline-recommendation-analytics.json';

$outcomesPayload = file_exists($outcomesPath) ? json_decode(file_get_contents($outcomesPath), true) : ['items' => []];
$analyticsPayload = file_exists($analyticsPath) ? json_decode(file_get_contents($analyticsPath), true) : ['items' => []];
$outcomeItems = is_array($outcomesPayload['items'] ?? null) ? $outcomesPayload['items'] : [];
$analyticsItems = is_array($analyticsPayload['items'] ?? null) ? $analyticsPayload['items'] : [];

$outcomesByAction = [];
foreach ($outcomeItems as $item) {
    $outcomesByAction[$item['action'] ?? ''] = $item;
}

$actions = [];
foreach ($analyticsItems as $item) {
    $action = trim((string) ($item['action'] ?? ''));
    if ($action !== '') $actions[$action] = true;
}
foreach ($outcomeItems as $item) {
    $action = trim((string) ($item['action'] ?? ''));
    if ($action !== '') $actions[$action] = true;
}

$items = array_map(function ($action) use ($outcomesByAction) {
    $outcome = $outcomesByAction[$action] ?? [];
    $positiveCount = intval($outcome['positiveCount'] ?? 0);
    $neutralCount = intval($outcome['neutralCount'] ?? 0);
    $negativeCount = intval($outcome['negativeCount'] ?? 0);
    $score = $positiveCount - $negativeCount;
    return [
        'action' => $action,
        'positiveCount' => $positiveCount,
        'neutralCount' => $neutralCount,
        'negativeCount' => $negativeCount,
        'score' => $score,
        'lastOutcome' => $outcome['lastOutcome'] ?? null,
        'lastOutcomeAt' => $outcome['lastOutcomeAt'] ?? null
    ];
}, array_keys($actions));

usort($items, function ($a, $b) {
    return intval($b['score'] ?? 0) <=> intval($a['score'] ?? 0)
        ?: strcmp((string) ($b['lastOutcomeAt'] ?? ''), (string) ($a['lastOutcomeAt'] ?? ''));
});

echo json_encode([
    'items' => $items,
    'totalPositive' => array_reduce($items, fn($sum, $item) => $sum + intval($item['positiveCount'] ?? 0), 0),
    'totalNeutral' => array_reduce($items, fn($sum, $item) => $sum + intval($item['neutralCount'] ?? 0), 0),
    'totalNegative' => array_reduce($items, fn($sum, $item) => $sum + intval($item['negativeCount'] ?? 0), 0)
]);
