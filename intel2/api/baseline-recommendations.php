<?php
header('Content-Type: application/json');
header('Cache-Control: no-store');

$path = dirname(__DIR__) . '/data/baseline-history.json';
$payload = file_exists($path) ? json_decode(file_get_contents($path), true) : ['items' => []];
$items = is_array($payload['items'] ?? null) ? $payload['items'] : [];

usort($items, function ($a, $b) {
    return strcmp((string) ($b['recordedAt'] ?? ''), (string) ($a['recordedAt'] ?? ''));
});

$totalEntries = count($items);
$steadyEntries = count(array_filter($items, fn($item) => ($item['label'] ?? '') === 'Steady'));
$savedBaselineEntries = count(array_filter($items, fn($item) => ($item['baselineMode'] ?? 'previous') === 'saved'));
$now = time();
$staleEntries = count(array_filter($items, function ($item) use ($now) {
    $ts = strtotime((string) ($item['recordedAt'] ?? ''));
    if (!$ts) return false;
    return ($now - $ts) > (12 * 60 * 60);
}));

$recent = array_slice($items, 0, 5);
$prior = array_slice($items, 5, 5);
$avg = function ($entries) {
    $count = count($entries);
    if ($count === 0) return 0;
    $sum = array_reduce($entries, function ($carry, $item) {
        return $carry + intval($item['score'] ?? 0);
    }, 0);
    return round($sum / $count, 2);
};
$drift = round($avg($recent) - $avg($prior), 2);

$itemsOut = [];
if ($totalEntries < 5) {
    $itemsOut[] = ['action' => 'grow-history', 'reason' => 'Baseline history is too thin for high-confidence guidance.'];
}
if ($drift >= 1) {
    $itemsOut[] = ['action' => 'review-hotter-drift', 'reason' => 'Recent baseline scores are trending hotter than the prior slice.'];
} elseif ($drift <= -1) {
    $itemsOut[] = ['action' => 'inspect-cooling-drift', 'reason' => 'Recent baseline scores are trending cooler than the prior slice.'];
}
if ($steadyEntries >= max(3, (int) ceil($totalEntries / 2))) {
    $itemsOut[] = ['action' => 'trim-flat-history', 'reason' => 'A large share of history is flat and may be diluting stronger signals.'];
}
if ($savedBaselineEntries === 0 && $totalEntries > 0) {
    $itemsOut[] = ['action' => 'add-saved-baseline', 'reason' => 'No saved-view baselines are represented in history yet.'];
}
if ($staleEntries > 0) {
    $itemsOut[] = ['action' => 'archive-stale-history', 'reason' => $staleEntries . ' history entries are older than 12 hours.'];
}
if (!$itemsOut) {
    $itemsOut[] = ['action' => 'maintain-current-baselines', 'reason' => 'Current baseline history and trends look healthy.'];
}

echo json_encode(['items' => $itemsOut]);
