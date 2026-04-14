<?php
header('Content-Type: application/json');
header('Cache-Control: no-store');

$path = dirname(__DIR__) . '/data/intel-tasks.json';
$payload = file_exists($path) ? json_decode(file_get_contents($path), true) : ['tasks' => []];

$activeCount = 0;
$totalSignals = 0;
$rankedTasks = [];

foreach ($payload['tasks'] ?? [] as $task) {
    if (($task['status'] ?? '') === 'active') {
        $activeCount++;
        $signals = intval($task['signalsAttached'] ?? 0);
        $totalSignals += $signals;
        
        $rankedTasks[] = [
            'id' => $task['id'],
            'name' => $task['name'] ?? 'Unnamed Task',
            'tag' => $task['tag'] ?? 'Uncategorized',
            'signalsAttached' => $signals
        ];
    }
}

usort($rankedTasks, function($a, $b) {
    $cmp = $b['signalsAttached'] <=> $a['signalsAttached'];
    if ($cmp !== 0) return $cmp;
    return strcmp($a['name'], $b['name']);
});

$avgSignals = $activeCount > 0 ? round($totalSignals / $activeCount, 1) : 0;

echo json_encode([
    'activeCount' => $activeCount,
    'totalSignals' => $totalSignals,
    'averageSignalsPerTask' => $avgSignals,
    'items' => array_slice($rankedTasks, 0, 5)
]);
