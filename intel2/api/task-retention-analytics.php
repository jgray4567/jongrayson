<?php
header('Content-Type: application/json');
header('Cache-Control: no-store');

$path = dirname(__DIR__) . '/data/intel-tasks.json';
$payload = file_exists($path) ? json_decode(file_get_contents($path), true) : ['tasks' => []];

$archivedTasks = [];
$totalDays = 0;

foreach ($payload['tasks'] ?? [] as $task) {
    if (($task['status'] ?? '') === 'archived') {
        $created = strtotime($task['createdAt'] ?? 'now');
        $archived = strtotime($task['archivedAt'] ?? 'now');
        
        $durationSeconds = max(0, $archived - $created);
        $durationDays = round($durationSeconds / 86400, 1);
        
        $totalDays += $durationDays;
        
        $archivedTasks[] = [
            'id' => $task['id'],
            'name' => $task['name'] ?? 'Unnamed Task',
            'tag' => $task['tag'] ?? 'Uncategorized',
            'lifespanDays' => $durationDays
        ];
    }
}

$avgLifespan = count($archivedTasks) > 0 ? round($totalDays / count($archivedTasks), 1) : 0;

usort($archivedTasks, function($a, $b) {
    return $b['lifespanDays'] <=> $a['lifespanDays'];
});

echo json_encode([
    'averageLifespanDays' => $avgLifespan,
    'archivedCount' => count($archivedTasks),
    'items' => array_slice($archivedTasks, 0, 5)
]);
