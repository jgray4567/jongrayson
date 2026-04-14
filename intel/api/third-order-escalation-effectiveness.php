<?php
header('Content-Type: application/json');
header('Cache-Control: no-store');

$path = dirname(__DIR__) . '/data/intel-analytics.json';
$payload = file_exists($path) ? json_decode(file_get_contents($path), true) : ['items' => []];
$items = [];

foreach ($payload['items'] ?? [] as $item) {
    $acceptCount = intval($item['thirdOrderEscalationAcceptCount'] ?? 0);
    $baseEffectiveness = (string) ($item['effectiveness'] ?? 'weak');
    $baseScore = $baseEffectiveness === 'effective' ? 2 : ($baseEffectiveness === 'mixed' ? 1 : 0);
    $effectivenessScore = $acceptCount + $baseScore;
    $effectiveness = 'weak';
    if ($effectivenessScore > 2) {
        $effectiveness = 'effective';
    } elseif ($effectivenessScore > 0) {
        $effectiveness = 'mixed';
    }

    $items[] = [
        'topic' => $item['topic'] ?? 'General',
        'suggestedQuery' => $item['suggestedQuery'] ?? '',
        'thirdOrderEscalationAction' => $item['thirdOrderEscalationAction'] ?? null,
        'thirdOrderEscalationAcceptCount' => $acceptCount,
        'effectivenessScore' => $effectivenessScore,
        'effectiveness' => $effectiveness,
    ];
}

usort($items, function ($a, $b) {
    $scoreCompare = intval($b['effectivenessScore'] ?? 0) <=> intval($a['effectivenessScore'] ?? 0);
    if ($scoreCompare !== 0) return $scoreCompare;
    return strcmp(($a['topic'] ?? ''), ($b['topic'] ?? ''));
});

echo json_encode(['items' => $items]);
