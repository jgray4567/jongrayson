<?php
header('Content-Type: application/json');
header('Cache-Control: no-store');

require_once __DIR__ . '/lib/recovery-trust.php';

$path = dirname(__DIR__) . '/data/baseline-recommendation-confidence-history.json';
$payload = file_exists($path) ? json_decode(file_get_contents($path), true) : ['items' => []];
$items = is_array($payload['items'] ?? null) ? $payload['items'] : [];

$items = array_map(fn($item) => array_merge($item, intel_compute_recovery_trust_metrics($item)), $items);

usort($items, function ($a, $b) {
    return intval($b['adjustmentCount'] ?? 0) <=> intval($a['adjustmentCount'] ?? 0)
        ?: strcmp((string) ($b['updatedAt'] ?? ''), (string) ($a['updatedAt'] ?? ''));
});

echo json_encode([
    'items' => $items,
    'upgradedCount' => count(array_filter($items, fn($item) => ($item['adjustmentDirection'] ?? '') === 'upgraded')),
    'downgradedCount' => count(array_filter($items, fn($item) => ($item['adjustmentDirection'] ?? '') === 'downgraded')),
    'adjustedCount' => count(array_filter($items, fn($item) => !empty($item['adjusted']))),
    'convergedCount' => count(array_filter($items, fn($item) => intval($item['convergenceCount'] ?? 0) > 0)),
    'justConvergedCount' => count(array_filter($items, fn($item) => !empty($item['justConverged']))),
    'dependentCount' => count(array_filter($items, fn($item) => intval($item['dependencyCount'] ?? 0) > 0)),
    'justBecameDependentCount' => count(array_filter($items, fn($item) => !empty($item['justBecameDependent']))),
    'recoveredCount' => count(array_filter($items, fn($item) => intval($item['dependencyRecoveryCount'] ?? 0) > 0)),
    'justRecoveredCount' => count(array_filter($items, fn($item) => !empty($item['justRecoveredFromDependency']))),
    'durableRecoveredCount' => count(array_filter($items, fn($item) => ($item['dependencyRecoveryDurability'] ?? '') === 'durable')),
    'justDurableRecoveredCount' => count(array_filter($items, fn($item) => !empty($item['justBecameDurableRecovery']))),
    'relapsedCount' => count(array_filter($items, fn($item) => intval($item['durableRecoveryRelapseCount'] ?? 0) > 0)),
    'justRelapsedCount' => count(array_filter($items, fn($item) => !empty($item['justRelapsedFromDurableRecovery']))),
    'resilientRecoveryCount' => count(array_filter($items, fn($item) => ($item['relapseResilienceBand'] ?? '') === 'resilient')),
    'fragileRecoveryCount' => count(array_filter($items, fn($item) => ($item['relapseResilienceBand'] ?? '') === 'fragile')),
    'matureRecoveryCount' => count(array_filter($items, fn($item) => ($item['recoveryMaturityBand'] ?? '') === 'mature')),
    'developingRecoveryCount' => count(array_filter($items, fn($item) => ($item['recoveryMaturityBand'] ?? '') === 'developing')),
    'risingRecoveryCount' => count(array_filter($items, fn($item) => ($item['recoveryMaturityDrift'] ?? '') === 'rising')),
    'fallingRecoveryCount' => count(array_filter($items, fn($item) => ($item['recoveryMaturityDrift'] ?? '') === 'falling')),
    'recoveryMaturityReversalCount' => count(array_filter($items, fn($item) => !empty($item['recoveryMaturityReversalCount']))),
    'justReversedRecoveryCount' => count(array_filter($items, fn($item) => !empty($item['recoveryMaturityJustReversed']))),
    'reversalStreakRecoveryCount' => count(array_filter($items, fn($item) => intval($item['recoveryMaturityReversalStreak'] ?? 0) > 0)),
    'stableRecoveryCount' => count(array_filter($items, fn($item) => intval($item['recoveryMaturityStabilityStreak'] ?? 0) > 0)),
    'highBreakdownRiskCount' => count(array_filter($items, fn($item) => ($item['recoveryMaturityBreakdownRiskBand'] ?? '') === 'high')),
    'watchBreakdownRiskCount' => count(array_filter($items, fn($item) => ($item['recoveryMaturityBreakdownRiskBand'] ?? '') === 'watch')),
    'strongRecoveryHealthCount' => count(array_filter($items, fn($item) => ($item['recoveryTrustHealthBand'] ?? '') === 'strong')),
    'stableRecoveryHealthCount' => count(array_filter($items, fn($item) => ($item['recoveryTrustHealthBand'] ?? '') === 'stable')),
    'fragileRecoveryHealthCount' => count(array_filter($items, fn($item) => ($item['recoveryTrustHealthBand'] ?? '') === 'fragile')),
    'improvingRecoveryHealthCount' => count(array_filter($items, fn($item) => ($item['recoveryTrustHealthTrend'] ?? '') === 'improving')),
    'decayingRecoveryHealthCount' => count(array_filter($items, fn($item) => ($item['recoveryTrustHealthTrend'] ?? '') === 'decaying')),
    'reversedRecoveryHealthCount' => count(array_filter($items, fn($item) => !empty($item['recoveryTrustHealthReversalCount']))),
    'justReversedRecoveryHealthCount' => count(array_filter($items, fn($item) => !empty($item['recoveryTrustHealthJustReversed']))),
    'reversalStreakRecoveryHealthCount' => count(array_filter($items, fn($item) => intval($item['recoveryTrustHealthReversalStreak'] ?? 0) > 0)),
    'positiveRecoveryTrustNetCount' => count(array_filter($items, fn($item) => intval($item['recoveryTrustNetAdjustment'] ?? 0) > 0)),
    'negativeRecoveryTrustNetCount' => count(array_filter($items, fn($item) => intval($item['recoveryTrustNetAdjustment'] ?? 0) < 0)),
    'healthDrivenRecoveryCount' => count(array_filter($items, fn($item) => ($item['recoveryTrustTopDriver'] ?? '') === 'health')),
    'maturityDrivenRecoveryCount' => count(array_filter($items, fn($item) => ($item['recoveryTrustTopDriver'] ?? '') === 'maturity')),
    'riskDrivenRecoveryCount' => count(array_filter($items, fn($item) => ($item['recoveryTrustTopDriver'] ?? '') === 'breakdown risk')),
    'driverShiftRecoveryCount' => count(array_filter($items, fn($item) => !empty($item['recoveryTrustDriverShiftCount']))),
    'justShiftedRecoveryCount' => count(array_filter($items, fn($item) => !empty($item['recoveryTrustDriverJustShifted']))),
    'driverShiftStreakRecoveryCount' => count(array_filter($items, fn($item) => intval($item['recoveryTrustDriverShiftStreak'] ?? 0) > 0)),
    'positiveDriverTransitionCount' => count(array_filter($items, fn($item) => intval($item['recoveryTrustDriverTransitionSeverityScore'] ?? 0) > 0)),
    'negativeDriverTransitionCount' => count(array_filter($items, fn($item) => intval($item['recoveryTrustDriverTransitionSeverityScore'] ?? 0) < 0)),
    'deterioratingDriverTransitionCount' => count(array_filter($items, fn($item) => ($item['recoveryTrustDriverTransitionSeverityBand'] ?? '') === 'deteriorating')),
    'negativeDriverTransitionStreakCount' => count(array_filter($items, fn($item) => intval($item['recoveryTrustDriverNegativeTransitionStreak'] ?? 0) > 0)),
    'positiveDriverTransitionStreakCount' => count(array_filter($items, fn($item) => intval($item['recoveryTrustDriverPositiveTransitionStreak'] ?? 0) > 0)),
    'positiveDriverTransitionBalanceCount' => count(array_filter($items, fn($item) => intval($item['recoveryTrustDriverTransitionBalanceScore'] ?? 0) > 0)),
    'negativeDriverTransitionBalanceCount' => count(array_filter($items, fn($item) => intval($item['recoveryTrustDriverTransitionBalanceScore'] ?? 0) < 0)),
    'balancedDriverTransitionBalanceCount' => count(array_filter($items, fn($item) => intval($item['recoveryTrustDriverTransitionBalanceScore'] ?? 0) === 0)),
    'reversedDriverTransitionBalanceCount' => count(array_filter($items, fn($item) => !empty($item['recoveryTrustDriverTransitionBalanceJustReversed']))),
    'positiveReversedDriverTransitionBalanceCount' => count(array_filter($items, fn($item) => !empty($item['recoveryTrustDriverTransitionBalanceJustReversed']) && intval($item['recoveryTrustDriverTransitionBalanceScore'] ?? 0) > 0)),
    'negativeReversedDriverTransitionBalanceCount' => count(array_filter($items, fn($item) => !empty($item['recoveryTrustDriverTransitionBalanceJustReversed']) && intval($item['recoveryTrustDriverTransitionBalanceScore'] ?? 0) < 0)),
    'reversalStreakDriverTransitionBalanceCount' => count(array_filter($items, fn($item) => intval($item['recoveryTrustDriverTransitionBalanceReversalStreak'] ?? 0) > 0)),
    'stableDriverTransitionBalanceCount' => count(array_filter($items, fn($item) => intval($item['recoveryTrustDriverTransitionBalanceStabilityStreak'] ?? 0) > 0)),
    'stableRecoveryLedDriverTransitionBalanceCount' => count(array_filter($items, fn($item) => intval($item['recoveryTrustDriverTransitionBalanceStabilityStreak'] ?? 0) > 0 && ($item['recoveryTrustDriverTransitionBalanceStabilityPolarity'] ?? '') === 'recovery')),
    'stableDeteriorationLedDriverTransitionBalanceCount' => count(array_filter($items, fn($item) => intval($item['recoveryTrustDriverTransitionBalanceStabilityStreak'] ?? 0) > 0 && ($item['recoveryTrustDriverTransitionBalanceStabilityPolarity'] ?? '') === 'deterioration')),
    'entrenchedDriverTransitionBalanceCount' => count(array_filter($items, fn($item) => ($item['recoveryTrustDriverTransitionBalanceEntrenchmentBand'] ?? 'none') !== 'none')),
    'recoveryEntrenchedDriverTransitionBalanceCount' => count(array_filter($items, fn($item) => ($item['recoveryTrustDriverTransitionBalanceEntrenchmentBand'] ?? '') === 'recovery-entrenched')),
    'deteriorationEntrenchedDriverTransitionBalanceCount' => count(array_filter($items, fn($item) => ($item['recoveryTrustDriverTransitionBalanceEntrenchmentBand'] ?? '') === 'deterioration-entrenched')),
    'justEntrenchedDriverTransitionBalanceCount' => count(array_filter($items, fn($item) => !empty($item['recoveryTrustDriverTransitionBalanceJustEntrenched']))),
    'escapedEntrenchedDriverTransitionBalanceCount' => count(array_filter($items, fn($item) => !empty($item['recoveryTrustDriverTransitionBalanceEscapedEntrenchment']))),
    'positiveEscapedEntrenchedDriverTransitionBalanceCount' => count(array_filter($items, fn($item) => !empty($item['recoveryTrustDriverTransitionBalanceEscapedEntrenchment']) && ($item['recoveryTrustDriverTransitionBalanceEntrenchmentEscapeDirection'] ?? '') === 'positive')),
    'negativeEscapedEntrenchedDriverTransitionBalanceCount' => count(array_filter($items, fn($item) => !empty($item['recoveryTrustDriverTransitionBalanceEscapedEntrenchment']) && ($item['recoveryTrustDriverTransitionBalanceEntrenchmentEscapeDirection'] ?? '') === 'negative')),
    'durableEscapedEntrenchedDriverTransitionBalanceCount' => count(array_filter($items, fn($item) => !empty($item['recoveryTrustDriverTransitionBalanceEscapedEntrenchmentDurably']))),
    'durablePositiveEscapedEntrenchedDriverTransitionBalanceCount' => count(array_filter($items, fn($item) => !empty($item['recoveryTrustDriverTransitionBalanceEscapedEntrenchmentDurably']) && ($item['recoveryTrustDriverTransitionBalanceEscapeDurabilityDirection'] ?? '') === 'positive')),
    'durableNegativeEscapedEntrenchedDriverTransitionBalanceCount' => count(array_filter($items, fn($item) => !empty($item['recoveryTrustDriverTransitionBalanceEscapedEntrenchmentDurably']) && ($item['recoveryTrustDriverTransitionBalanceEscapeDurabilityDirection'] ?? '') === 'negative')),
    'recapturedEntrenchedDriverTransitionBalanceCount' => count(array_filter($items, fn($item) => !empty($item['recoveryTrustDriverTransitionBalanceRecapturedEntrenchment']))),
    'positiveRecapturedEntrenchedDriverTransitionBalanceCount' => count(array_filter($items, fn($item) => !empty($item['recoveryTrustDriverTransitionBalanceRecapturedEntrenchment']) && ($item['recoveryTrustDriverTransitionBalanceRecaptureDirection'] ?? '') === 'positive')),
    'negativeRecapturedEntrenchedDriverTransitionBalanceCount' => count(array_filter($items, fn($item) => !empty($item['recoveryTrustDriverTransitionBalanceRecapturedEntrenchment']) && ($item['recoveryTrustDriverTransitionBalanceRecaptureDirection'] ?? '') === 'negative')),
    'recaptureStreakDriverTransitionBalanceCount' => count(array_filter($items, fn($item) => intval($item['recoveryTrustDriverTransitionBalanceRecaptureStreak'] ?? 0) > 0)),
    'terminalStructuralStateCount' => count(array_filter($items, fn($item) => ($item['recoveryTrustDriverTransitionBalanceStructuralState'] ?? '') === 'terminal')),
    'compromisedStructuralStateCount' => count(array_filter($items, fn($item) => ($item['recoveryTrustDriverTransitionBalanceStructuralState'] ?? '') === 'compromised')),
    'weakeningStructuralStateCount' => count(array_filter($items, fn($item) => ($item['recoveryTrustDriverTransitionBalanceStructuralState'] ?? '') === 'weakening')),
    'contestedStructuralStateCount' => count(array_filter($items, fn($item) => ($item['recoveryTrustDriverTransitionBalanceStructuralState'] ?? '') === 'contested')),
    'soundStructuralStateCount' => count(array_filter($items, fn($item) => ($item['recoveryTrustDriverTransitionBalanceStructuralState'] ?? '') === 'sound')),
    'fortifiedStructuralStateCount' => count(array_filter($items, fn($item) => ($item['recoveryTrustDriverTransitionBalanceStructuralState'] ?? '') === 'fortified'))
]);
