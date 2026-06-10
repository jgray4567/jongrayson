<?php
header('Content-Type: application/json');
header('Cache-Control: no-store');

$analyticsPath = dirname(__DIR__) . '/data/baseline-recommendation-analytics.json';
$outcomesPath = dirname(__DIR__) . '/data/baseline-recommendation-outcomes.json';

$analyticsPayload = file_exists($analyticsPath) ? json_decode(file_get_contents($analyticsPath), true) : ['items' => []];
$outcomesPayload = file_exists($outcomesPath) ? json_decode(file_get_contents($outcomesPath), true) : ['items' => []];
$analyticsItems = is_array($analyticsPayload['items'] ?? null) ? $analyticsPayload['items'] : [];
$outcomeItems = is_array($outcomesPayload['items'] ?? null) ? $outcomesPayload['items'] : [];

$analyticsByAction = [];
foreach ($analyticsItems as $item) {
    $analyticsByAction[$item['action'] ?? ''] = $item;
}

$playbook = [];
foreach ($outcomeItems as $item) {
    $action = trim((string) ($item['action'] ?? ''));
    if ($action === '') continue;
    $positiveCount = intval($item['positiveCount'] ?? 0);
    $negativeCount = intval($item['negativeCount'] ?? 0);
    $neutralCount = intval($item['neutralCount'] ?? 0);
    $outcomeScore = $positiveCount - $negativeCount;
    if ($outcomeScore <= 0 && $positiveCount < 2) continue;

    $analytics = $analyticsByAction[$action] ?? [];
    $acceptedCount = intval($analytics['acceptedCount'] ?? 0);
    $surfacedCount = intval($analytics['surfacedCount'] ?? 0);
    $acceptanceRate = $surfacedCount > 0 ? round($acceptedCount / $surfacedCount, 2) : 0;
    $lastOutcomeAt = $item['lastOutcomeAt'] ?? null;
    $lastTs = $lastOutcomeAt ? strtotime((string) $lastOutcomeAt) : 0;
    $ageSeconds = $lastTs ? max(0, time() - $lastTs) : PHP_INT_MAX;
    $freshness = 'fresh';
    $decayMultiplier = 1;
    if ($ageSeconds > 24 * 60 * 60) {
        $freshness = 'stale';
        $decayMultiplier = 0.25;
    } elseif ($ageSeconds > 12 * 60 * 60) {
        $freshness = 'aging';
        $decayMultiplier = 0.6;
    }
    $rawPlaybookScore = round(($positiveCount * 20) + ($acceptanceRate * 100) - ($negativeCount * 10), 2);
    $playbookScore = round($rawPlaybookScore * $decayMultiplier, 2);
    $confidence = 'emerging';
    if (($positiveCount >= 3 && $freshness === 'fresh') || $playbookScore >= 80) $confidence = 'proven';
    elseif (($positiveCount >= 2 && $freshness !== 'stale') || $playbookScore >= 40) $confidence = 'strong';

    $playbook[] = [
        'action' => $action,
        'positiveCount' => $positiveCount,
        'neutralCount' => $neutralCount,
        'negativeCount' => $negativeCount,
        'outcomeScore' => $outcomeScore,
        'acceptedCount' => $acceptedCount,
        'surfacedCount' => $surfacedCount,
        'acceptanceRate' => $acceptanceRate,
        'freshness' => $freshness,
        'decayMultiplier' => $decayMultiplier,
        'rawPlaybookScore' => $rawPlaybookScore,
        'playbookScore' => $playbookScore,
        'confidence' => $confidence,
        'lastOutcomeAt' => $lastOutcomeAt
    ];
}

usort($playbook, function ($a, $b) {
    return ($b['playbookScore'] ?? 0) <=> ($a['playbookScore'] ?? 0)
        ?: strcmp((string) ($b['confidence'] ?? ''), (string) ($a['confidence'] ?? ''));
});

echo json_encode([
    'items' => $playbook,
    'topAction' => $playbook[0]['action'] ?? null,
    'topConfidence' => $playbook[0]['confidence'] ?? null,
    'topScore' => $playbook[0]['playbookScore'] ?? 0
]);
