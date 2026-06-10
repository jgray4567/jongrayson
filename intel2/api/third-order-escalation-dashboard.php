<?php
header('Content-Type: application/json');
header('Cache-Control: no-store');

$path = dirname(__DIR__) . '/data/intel-analytics.json';
$payload = file_exists($path) ? json_decode(file_get_contents($path), true) : ['items' => []];

$totalCases = 0;
$totalAccepts = 0;
$effectiveCount = 0;
$mixedCount = 0;
$weakCount = 0;

foreach ($payload['items'] ?? [] as $item) {
    $totalCases++;
    $acceptCount = intval($item['thirdOrderEscalationAcceptCount'] ?? 0);
    $totalAccepts += $acceptCount;

    $baseEffectiveness = (string) ($item['effectiveness'] ?? 'weak');
    $baseScore = $baseEffectiveness === 'effective' ? 2 : ($baseEffectiveness === 'mixed' ? 1 : 0);
    $effectivenessScore = $acceptCount + $baseScore;

    if ($effectivenessScore > 2) {
        $effectiveCount++;
    } elseif ($effectivenessScore > 0) {
        $mixedCount++;
    } else {
        $weakCount++;
    }
}

echo json_encode([
    'escalationCaseCount' => $totalCases,
    'totalAccepts' => $totalAccepts,
    'effectiveCount' => $effectiveCount,
    'mixedCount' => $mixedCount,
    'weakCount' => $weakCount
]);
