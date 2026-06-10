<?php
header('Content-Type: application/json');
header('Cache-Control: no-store');

$path = dirname(__DIR__) . '/data/intel-signals.json';
$payload = file_exists($path) ? json_decode(file_get_contents($path), true) : ['items' => []];

$sourceFilter = trim((string) ($_GET['source'] ?? ''));
$severityFilter = trim((string) ($_GET['severity'] ?? ''));
$viewFilter = trim((string) ($_GET['view'] ?? 'active'));
$tagFilter = trim((string) ($_GET['tag'] ?? ''));
$taskIdFilter = trim((string) ($_GET['taskId'] ?? ''));
$recoveredFilter = trim((string) ($_GET['recovered'] ?? ''));
$timeFilter = trim((string) ($_GET['time'] ?? ''));
$windowMinutes = max(1, intval($_GET['windowMinutes'] ?? 60));

$items = array_values(array_filter($payload['items'] ?? [], function ($item) use ($sourceFilter, $severityFilter, $viewFilter, $tagFilter, $taskIdFilter, $recoveredFilter, $timeFilter, $windowMinutes) {
    $status = $item['status'] ?? 'new';
    $validStatuses = $viewFilter === 'archived' ? ['acknowledge', 'dismiss', 'escalate', 'converted'] : ['new', 'active'];
    
    if (!in_array($status, $validStatuses)) return false;
    if ($sourceFilter !== '' && ($item['source'] ?? '') !== $sourceFilter) return false;
    if ($severityFilter !== '' && ($item['severity'] ?? '') !== $severityFilter) return false;
    if ($tagFilter !== '' && ($item['taskTag'] ?? '') !== $tagFilter) return false;
    if ($taskIdFilter !== '' && ($item['taskId'] ?? '') !== $taskIdFilter) return false;
    if ($recoveredFilter !== '' && intval($item['recoverCount'] ?? 0) < 1) return false;
    
    if ($timeFilter !== '') {
        $t1 = intval($timeFilter);
        $t2 = strtotime($item['timestamp'] ?? 'now') * 1000;
        if (abs($t1 - $t2) > ($windowMinutes * 60 * 1000)) return false;
    }
    
    return true;
}));

// Sort descending by timestamp
usort($items, function ($a, $b) {
    return strcmp($b['timestamp'] ?? '', $a['timestamp'] ?? '');
});

echo json_encode(['items' => $items]);
