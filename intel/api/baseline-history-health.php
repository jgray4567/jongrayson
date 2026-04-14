<?php
header('Content-Type: application/json');
header('Cache-Control: no-store');

$path = dirname(__DIR__) . '/data/baseline-history.json';
$payload = file_exists($path) ? json_decode(file_get_contents($path), true) : ['items' => []];
$items = is_array($payload['items'] ?? null) ? $payload['items'] : [];

$totalEntries = count($items);
$steadyEntries = count(array_filter($items, fn($item) => ($item['label'] ?? '') === 'Steady'));
$savedBaselineEntries = count(array_filter($items, fn($item) => ($item['baselineMode'] ?? 'previous') === 'saved'));
$now = time();
$staleEntries = count(array_filter($items, function ($item) use ($now) {
    $ts = strtotime((string) ($item['recordedAt'] ?? ''));
    if (!$ts) return false;
    return ($now - $ts) > (12 * 60 * 60);
}));

$suggestions = [];
if ($totalEntries < 5) {
    $suggestions[] = ['action' => 'grow-history', 'reason' => 'Too little comparison history for strong trend confidence.'];
}
if ($steadyEntries >= max(3, (int) ceil($totalEntries / 2))) {
    $suggestions[] = ['action' => 'prune-flat-runs', 'reason' => 'A large share of history is flat/steady and may add noise.'];
}
if ($savedBaselineEntries === 0 && $totalEntries > 0) {
    $suggestions[] = ['action' => 'use-saved-baselines', 'reason' => 'History is dominated by previous-window baselines with no deliberate saved-view baselines.'];
}
if ($staleEntries > 0) {
    $suggestions[] = ['action' => 'archive-stale-history', 'reason' => $staleEntries . ' history entries are older than 12 hours.'];
}
if (!$suggestions) {
    $suggestions[] = ['action' => 'healthy-history', 'reason' => 'History coverage looks healthy right now.'];
}

echo json_encode([
    'totalEntries' => $totalEntries,
    'steadyEntries' => $steadyEntries,
    'savedBaselineEntries' => $savedBaselineEntries,
    'staleEntries' => $staleEntries,
    'items' => $suggestions
]);
