<?php

function intel_compute_recovery_trust_metrics(array $item): array {
    $durableRecoveryCount = intval($item['durableRecoveryCount'] ?? 0);
    $durableRecoveryRelapseCount = intval($item['durableRecoveryRelapseCount'] ?? 0);
    $relapseResilienceScore = max(-100, min(100, ($durableRecoveryCount * 12) - ($durableRecoveryRelapseCount * 15)));
    $relapseResilienceBand = 'neutral';
    if ($relapseResilienceScore >= 20) $relapseResilienceBand = 'resilient';
    elseif ($relapseResilienceScore <= -20) $relapseResilienceBand = 'fragile';
    $relapseResilienceAdjustment = 0;
    if ($relapseResilienceBand === 'resilient') $relapseResilienceAdjustment = 8;
    elseif ($relapseResilienceBand === 'fragile') $relapseResilienceAdjustment = -8;

    $dependencyRecoveryStreak = intval($item['dependencyRecoveryStreak'] ?? 0);
    $dependencyRecoveryDurability = (string) ($item['dependencyRecoveryDurability'] ?? 'fragile');
    $recoveryMaturityScore = max(0, min(100, ($dependencyRecoveryStreak * 12) + ($dependencyRecoveryDurability === 'durable' ? 25 : ($dependencyRecoveryDurability === 'tentative' ? 10 : 0)) + max(0, $relapseResilienceScore)));
    $recoveryMaturityBand = 'early';
    if ($recoveryMaturityScore >= 70) $recoveryMaturityBand = 'mature';
    elseif ($recoveryMaturityScore >= 35) $recoveryMaturityBand = 'developing';
    $recoveryMaturityAdjustment = 0;
    if ($recoveryMaturityBand === 'mature') $recoveryMaturityAdjustment = 10;
    elseif ($recoveryMaturityBand === 'developing') $recoveryMaturityAdjustment = 5;

    $recoveryMaturityDelta = floatval($item['recoveryMaturityDelta'] ?? 0);
    $recoveryMaturityDrift = (string) ($item['recoveryMaturityDrift'] ?? 'steady');
    $recoveryMaturityDriftAdjustment = 0;
    if ($recoveryMaturityDrift === 'rising') $recoveryMaturityDriftAdjustment = 5;
    elseif ($recoveryMaturityDrift === 'falling') $recoveryMaturityDriftAdjustment = -5;

    $recoveryMaturityReversalCount = intval($item['recoveryMaturityReversalCount'] ?? 0);
    $recoveryMaturityReversalStreak = intval($item['recoveryMaturityReversalStreak'] ?? 0);
    $recoveryMaturityStabilityStreak = intval($item['recoveryMaturityStabilityStreak'] ?? 0);
    $recoveryMaturityJustReversed = !empty($item['recoveryMaturityJustReversed']);
    $recoveryMaturityReversalAdjustment = $recoveryMaturityJustReversed ? -6 : 0;
    $recoveryMaturityReversalStreakAdjustment = $recoveryMaturityReversalStreak > 0 ? -min(9, $recoveryMaturityReversalStreak * 3) : 0;
    $recoveryMaturityStabilityBoost = $recoveryMaturityStabilityStreak > 0 ? min(8, $recoveryMaturityStabilityStreak * 2) : 0;

    $recoveryMaturityBreakdownRiskScore = floatval($item['recoveryMaturityBreakdownRiskScore'] ?? 0);
    $recoveryMaturityBreakdownRiskBand = (string) ($item['recoveryMaturityBreakdownRiskBand'] ?? 'low');
    $recoveryMaturityBreakdownRiskAdjustment = 0;
    if ($recoveryMaturityBreakdownRiskBand === 'high') $recoveryMaturityBreakdownRiskAdjustment = -7;
    elseif ($recoveryMaturityBreakdownRiskBand === 'watch') $recoveryMaturityBreakdownRiskAdjustment = -4;

    $recoveryTrustHealthScore = floatval($item['recoveryTrustHealthScore'] ?? 0);
    $recoveryTrustHealthBand = (string) ($item['recoveryTrustHealthBand'] ?? 'fragile');
    $recoveryTrustHealthAdjustment = 0;
    if ($recoveryTrustHealthBand === 'strong') $recoveryTrustHealthAdjustment = 8;
    elseif ($recoveryTrustHealthBand === 'stable') $recoveryTrustHealthAdjustment = 4;
    elseif ($recoveryTrustHealthBand === 'fragile') $recoveryTrustHealthAdjustment = -8;

    $recoveryTrustHealthDelta = floatval($item['recoveryTrustHealthDelta'] ?? 0);
    $recoveryTrustHealthTrend = (string) ($item['recoveryTrustHealthTrend'] ?? 'steady');
    $recoveryTrustHealthTrendAdjustment = 0;
    if ($recoveryTrustHealthTrend === 'improving') $recoveryTrustHealthTrendAdjustment = 5;
    elseif ($recoveryTrustHealthTrend === 'decaying') $recoveryTrustHealthTrendAdjustment = -5;

    $recoveryTrustHealthReversalCount = intval($item['recoveryTrustHealthReversalCount'] ?? 0);
    $recoveryTrustHealthReversalStreak = intval($item['recoveryTrustHealthReversalStreak'] ?? 0);
    $recoveryTrustHealthJustReversed = !empty($item['recoveryTrustHealthJustReversed']);
    $recoveryTrustHealthReversalAdjustment = $recoveryTrustHealthJustReversed ? -6 : 0;
    $recoveryTrustHealthReversalStreakAdjustment = $recoveryTrustHealthReversalStreak > 0 ? -min(9, $recoveryTrustHealthReversalStreak * 3) : 0;

    $recoveryTrustContributions = array_values(array_filter([
        ['label' => 'relapse', 'value' => $relapseResilienceAdjustment],
        ['label' => 'maturity', 'value' => $recoveryMaturityAdjustment],
        ['label' => 'maturity drift', 'value' => $recoveryMaturityDriftAdjustment],
        ['label' => 'maturity reversal', 'value' => $recoveryMaturityReversalAdjustment],
        ['label' => 'maturity whipsaw', 'value' => $recoveryMaturityReversalStreakAdjustment],
        ['label' => 'maturity stability', 'value' => $recoveryMaturityStabilityBoost],
        ['label' => 'breakdown risk', 'value' => $recoveryMaturityBreakdownRiskAdjustment],
        ['label' => 'health', 'value' => $recoveryTrustHealthAdjustment],
        ['label' => 'health trend', 'value' => $recoveryTrustHealthTrendAdjustment],
        ['label' => 'health reversal', 'value' => $recoveryTrustHealthReversalAdjustment],
        ['label' => 'health whipsaw', 'value' => $recoveryTrustHealthReversalStreakAdjustment],
    ], fn($entry) => intval($entry['value']) !== 0));

    usort($recoveryTrustContributions, function ($a, $b) {
        return abs(intval($b['value'])) <=> abs(intval($a['value']))
            ?: strcmp((string) $a['label'], (string) $b['label']);
    });

    $recoveryTrustNetAdjustment = array_reduce($recoveryTrustContributions, fn($sum, $entry) => $sum + intval($entry['value']), 0);
    $recoveryTrustAdjustmentCount = count($recoveryTrustContributions);
    $recoveryTrustTopDriver = $recoveryTrustContributions[0]['label'] ?? null;
    $recoveryTrustTopDriverAdjustment = intval($recoveryTrustContributions[0]['value'] ?? 0);
    $recoveryTrustAdjustmentSummary = implode(', ', array_map(
        fn($entry) => $entry['label'] . ' ' . (intval($entry['value']) > 0 ? '+' : '') . intval($entry['value']),
        array_slice($recoveryTrustContributions, 0, 3)
    ));

    return [
        'relapseResilienceScore' => $relapseResilienceScore,
        'relapseResilienceBand' => $relapseResilienceBand,
        'relapseResilienceAdjustment' => $relapseResilienceAdjustment,
        'recoveryMaturityScore' => $recoveryMaturityScore,
        'recoveryMaturityBand' => $recoveryMaturityBand,
        'recoveryMaturityAdjustment' => $recoveryMaturityAdjustment,
        'recoveryMaturityDelta' => $recoveryMaturityDelta,
        'recoveryMaturityDrift' => $recoveryMaturityDrift,
        'recoveryMaturityDriftAdjustment' => $recoveryMaturityDriftAdjustment,
        'recoveryMaturityReversalCount' => $recoveryMaturityReversalCount,
        'recoveryMaturityReversalStreak' => $recoveryMaturityReversalStreak,
        'recoveryMaturityStabilityStreak' => $recoveryMaturityStabilityStreak,
        'recoveryMaturityJustReversed' => $recoveryMaturityJustReversed,
        'recoveryMaturityReversalAdjustment' => $recoveryMaturityReversalAdjustment,
        'recoveryMaturityReversalStreakAdjustment' => $recoveryMaturityReversalStreakAdjustment,
        'recoveryMaturityStabilityBoost' => $recoveryMaturityStabilityBoost,
        'recoveryMaturityBreakdownRiskScore' => $recoveryMaturityBreakdownRiskScore,
        'recoveryMaturityBreakdownRiskBand' => $recoveryMaturityBreakdownRiskBand,
        'recoveryMaturityBreakdownRiskAdjustment' => $recoveryMaturityBreakdownRiskAdjustment,
        'recoveryTrustHealthScore' => $recoveryTrustHealthScore,
        'recoveryTrustHealthBand' => $recoveryTrustHealthBand,
        'recoveryTrustHealthAdjustment' => $recoveryTrustHealthAdjustment,
        'recoveryTrustHealthDelta' => $recoveryTrustHealthDelta,
        'recoveryTrustHealthTrend' => $recoveryTrustHealthTrend,
        'recoveryTrustHealthTrendAdjustment' => $recoveryTrustHealthTrendAdjustment,
        'recoveryTrustHealthReversalCount' => $recoveryTrustHealthReversalCount,
        'recoveryTrustHealthReversalStreak' => $recoveryTrustHealthReversalStreak,
        'recoveryTrustHealthJustReversed' => $recoveryTrustHealthJustReversed,
        'recoveryTrustHealthReversalAdjustment' => $recoveryTrustHealthReversalAdjustment,
        'recoveryTrustHealthReversalStreakAdjustment' => $recoveryTrustHealthReversalStreakAdjustment,
        'recoveryTrustContributions' => $recoveryTrustContributions,
        'recoveryTrustNetAdjustment' => $recoveryTrustNetAdjustment,
        'recoveryTrustAdjustmentCount' => $recoveryTrustAdjustmentCount,
        'recoveryTrustTopDriver' => $recoveryTrustTopDriver,
        'recoveryTrustTopDriverAdjustment' => $recoveryTrustTopDriverAdjustment,
        'recoveryTrustAdjustmentSummary' => $recoveryTrustAdjustmentSummary,
    ];
}
