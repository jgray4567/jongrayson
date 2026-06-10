<?php
header('Content-Type: application/json');
header('Cache-Control: no-store');

require_once __DIR__ . '/lib/recovery-trust.php';

$path = dirname(__DIR__) . '/data/baseline-recommendation-confidence-history.json';
if (!file_exists($path)) {
    file_put_contents($path, json_encode(['items' => []], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");
}

$payload = json_decode(file_get_contents($path), true);
if (!is_array($payload)) $payload = ['items' => []];
if (!isset($payload['items']) || !is_array($payload['items'])) $payload['items'] = [];

$input = json_decode(file_get_contents('php://input'), true);
$items = is_array($input['items'] ?? null) ? $input['items'] : [];

foreach ($items as $incoming) {
    $action = trim((string) ($incoming['action'] ?? ''));
    $band = trim((string) ($incoming['confidenceBand'] ?? 'low'));
    $baseBand = trim((string) ($incoming['baseConfidenceBand'] ?? $band));
    $score = floatval($incoming['priorityScore'] ?? 0);
    if ($action === '') continue;
    $found = false;
    foreach ($payload['items'] as &$item) {
        if (($item['action'] ?? '') === $action) {
            $previousScore = floatval($item['currentScore'] ?? 0);
            $delta = round($score - $previousScore, 2);
            $trend = abs($delta) < 5 ? 'steady' : ($delta > 0 ? 'rising' : 'falling');
            $previousTrend = $item['trend'] ?? null;
            $trendShiftCount = intval($item['trendShiftCount'] ?? 0);
            if ($previousTrend !== null && $previousTrend !== $trend) {
                $trendShiftCount += 1;
            }
            $volatilityState = 'low';
            if ($trendShiftCount >= 3 || abs($delta) >= 15) $volatilityState = 'high';
            elseif ($trendShiftCount >= 1 || abs($delta) >= 8) $volatilityState = 'medium';
            $adjusted = $baseBand !== $band;
            $previousAdjusted = !empty($item['adjusted']);
            $adjustmentDirection = 'none';
            $rank = ['low' => 0, 'guarded' => 1, 'medium' => 2, 'high' => 3];
            if ($adjusted) {
                $adjustmentDirection = ($rank[$band] ?? 0) > ($rank[$baseBand] ?? 0) ? 'upgraded' : 'downgraded';
            }
            $adjustmentCount = intval($item['adjustmentCount'] ?? 0);
            $upgradedCount = intval($item['upgradedCount'] ?? 0);
            $downgradedCount = intval($item['downgradedCount'] ?? 0);
            if (($item['adjusted'] ?? false) !== $adjusted || ($item['baseBand'] ?? null) !== $baseBand || ($item['currentBand'] ?? null) !== $band) {
                if ($adjusted) {
                    $adjustmentCount += 1;
                    if ($adjustmentDirection === 'upgraded') $upgradedCount += 1;
                    elseif ($adjustmentDirection === 'downgraded') $downgradedCount += 1;
                }
            }
            $convergenceCount = intval($item['convergenceCount'] ?? 0);
            $convergenceStreak = intval($item['convergenceStreak'] ?? 0);
            $justConverged = false;
            $dependencyCount = intval($item['dependencyCount'] ?? 0);
            $dependencyStreak = intval($item['dependencyStreak'] ?? 0);
            $justBecameDependent = false;
            $previousDependencyStreak = $dependencyStreak;
            $dependencyRecoveryCount = intval($item['dependencyRecoveryCount'] ?? 0);
            $dependencyRecoveryStreak = intval($item['dependencyRecoveryStreak'] ?? 0);
            $justRecoveredFromDependency = false;
            $previousDependencyRecoveryDurability = (string) ($item['dependencyRecoveryDurability'] ?? 'fragile');
            $durableRecoveryCount = intval($item['durableRecoveryCount'] ?? 0);
            $justBecameDurableRecovery = false;
            $durableRecoveryRelapseCount = intval($item['durableRecoveryRelapseCount'] ?? 0);
            $justRelapsedFromDurableRecovery = false;
            $everAdjusted = $previousAdjusted || $adjustmentCount > 0 || $upgradedCount > 0 || $downgradedCount > 0;
            if (!$adjusted && $everAdjusted) {
                if ($previousAdjusted) {
                    $convergenceCount += 1;
                    $convergenceStreak = 1;
                    $justConverged = true;
                } else {
                    $convergenceStreak += 1;
                }
            } else {
                $convergenceStreak = 0;
            }
            if ($adjusted) {
                if (!$previousAdjusted) {
                    $dependencyCount += 1;
                    $dependencyStreak = 1;
                    $justBecameDependent = true;
                } else {
                    $dependencyStreak += 1;
                }
                if ($previousDependencyRecoveryDurability === 'durable') {
                    $durableRecoveryRelapseCount += 1;
                    $justRelapsedFromDurableRecovery = true;
                }
                $dependencyRecoveryStreak = 0;
                $previousDependencyRecoveryDurability = 'fragile';
            } else {
                $dependencyStreak = 0;
                if ($previousDependencyStreak > 0) {
                    $dependencyRecoveryCount += 1;
                    $dependencyRecoveryStreak = 1;
                    $justRecoveredFromDependency = true;
                } elseif ($dependencyRecoveryStreak > 0 || $dependencyRecoveryCount > 0) {
                    $dependencyRecoveryStreak += 1;
                } else {
                    $dependencyRecoveryStreak = 0;
                }
            }
            $dependencyRecoveryDurability = 'fragile';
            if ($dependencyRecoveryStreak >= 4) $dependencyRecoveryDurability = 'durable';
            elseif ($dependencyRecoveryStreak >= 2) $dependencyRecoveryDurability = 'tentative';
            if ($dependencyRecoveryDurability === 'durable' && $previousDependencyRecoveryDurability !== 'durable') {
                $durableRecoveryCount += 1;
                $justBecameDurableRecovery = true;
            }
            $previousRecoveryMaturityScore = intval($item['recoveryMaturityScore'] ?? 0);
            $previousRecoveryMaturityBand = (string) ($item['recoveryMaturityBand'] ?? 'early');
            $recoveryRelapseResilienceScore = max(-100, min(100, ($durableRecoveryCount * 12) - ($durableRecoveryRelapseCount * 15)));
            $recoveryMaturityScore = max(0, min(100, ($dependencyRecoveryStreak * 12) + ($dependencyRecoveryDurability === 'durable' ? 25 : ($dependencyRecoveryDurability === 'tentative' ? 10 : 0)) + max(0, $recoveryRelapseResilienceScore)));
            $recoveryMaturityBand = 'early';
            if ($recoveryMaturityScore >= 70) $recoveryMaturityBand = 'mature';
            elseif ($recoveryMaturityScore >= 35) $recoveryMaturityBand = 'developing';
            $recoveryMaturityDelta = $recoveryMaturityScore - $previousRecoveryMaturityScore;
            $recoveryMaturityDrift = abs($recoveryMaturityDelta) < 5 ? 'steady' : ($recoveryMaturityDelta > 0 ? 'rising' : 'falling');
            $previousRecoveryMaturityDrift = (string) ($item['recoveryMaturityDrift'] ?? 'steady');
            $recoveryMaturityReversalCount = intval($item['recoveryMaturityReversalCount'] ?? 0);
            $recoveryMaturityReversalStreak = intval($item['recoveryMaturityReversalStreak'] ?? 0);
            $previousRecoveryMaturityStabilityStreak = intval($item['recoveryMaturityStabilityStreak'] ?? 0);
            $recoveryMaturityStabilityStreak = $previousRecoveryMaturityStabilityStreak;
            $recoveryMaturityJustReversed = false;
            if ($recoveryMaturityDrift !== 'steady' && $previousRecoveryMaturityDrift !== 'steady' && $previousRecoveryMaturityDrift !== $recoveryMaturityDrift) {
                $recoveryMaturityReversalCount += 1;
                $recoveryMaturityReversalStreak += 1;
                $recoveryMaturityJustReversed = true;
            } else {
                $recoveryMaturityReversalStreak = 0;
            }
            if ($recoveryMaturityDrift !== 'steady' && $previousRecoveryMaturityDrift === $recoveryMaturityDrift) {
                $recoveryMaturityStabilityStreak += 1;
            } elseif ($recoveryMaturityDrift !== 'steady') {
                $recoveryMaturityStabilityStreak = 1;
            } else {
                $recoveryMaturityStabilityStreak = 0;
            }
            $recoveryMaturityBreakdownRiskScore = 0;
            if ($previousRecoveryMaturityStabilityStreak >= 3 && $recoveryMaturityDrift === 'falling') {
                $recoveryMaturityBreakdownRiskScore = 70;
            } elseif ($previousRecoveryMaturityStabilityStreak >= 2 && $recoveryMaturityDelta <= -5) {
                $recoveryMaturityBreakdownRiskScore = 40;
            }
            $recoveryMaturityBreakdownRiskBand = 'low';
            if ($recoveryMaturityBreakdownRiskScore >= 60) $recoveryMaturityBreakdownRiskBand = 'high';
            elseif ($recoveryMaturityBreakdownRiskScore >= 30) $recoveryMaturityBreakdownRiskBand = 'watch';
            $recoveryTrustHealthScore = max(0, min(100,
                $recoveryMaturityScore
                + ($recoveryMaturityDrift === 'rising' ? 6 : ($recoveryMaturityDrift === 'falling' ? -6 : 0))
                + min(12, $recoveryMaturityStabilityStreak * 4)
                - min(18, $recoveryMaturityReversalStreak * 6)
                - intval(round($recoveryMaturityBreakdownRiskScore / 2))
            ));
            $recoveryTrustHealthBand = 'fragile';
            if ($recoveryTrustHealthScore >= 70) $recoveryTrustHealthBand = 'strong';
            elseif ($recoveryTrustHealthScore >= 40) $recoveryTrustHealthBand = 'stable';
            $previousRecoveryTrustHealthScore = intval($item['recoveryTrustHealthScore'] ?? 0);
            $previousRecoveryTrustHealthBand = (string) ($item['recoveryTrustHealthBand'] ?? 'fragile');
            $recoveryTrustHealthDelta = $recoveryTrustHealthScore - $previousRecoveryTrustHealthScore;
            $recoveryTrustHealthTrend = abs($recoveryTrustHealthDelta) < 5 ? 'steady' : ($recoveryTrustHealthDelta > 0 ? 'improving' : 'decaying');
            $previousRecoveryTrustHealthTrend = (string) ($item['recoveryTrustHealthTrend'] ?? 'steady');
            $recoveryTrustHealthReversalCount = intval($item['recoveryTrustHealthReversalCount'] ?? 0);
            $recoveryTrustHealthReversalStreak = intval($item['recoveryTrustHealthReversalStreak'] ?? 0);
            $recoveryTrustHealthJustReversed = false;
            if ($recoveryTrustHealthTrend !== 'steady' && $previousRecoveryTrustHealthTrend !== 'steady' && $previousRecoveryTrustHealthTrend !== $recoveryTrustHealthTrend) {
                $recoveryTrustHealthReversalCount += 1;
                $recoveryTrustHealthReversalStreak += 1;
                $recoveryTrustHealthJustReversed = true;
            } else {
                $recoveryTrustHealthReversalStreak = 0;
            }

            $previousRecoveryTopDriver = intel_compute_recovery_trust_metrics($item);
            $currentRecoveryTopDriver = intel_compute_recovery_trust_metrics(array_merge($item, [
                'durableRecoveryCount' => $durableRecoveryCount,
                'durableRecoveryRelapseCount' => $durableRecoveryRelapseCount,
                'dependencyRecoveryStreak' => $dependencyRecoveryStreak,
                'dependencyRecoveryDurability' => $dependencyRecoveryDurability,
                'recoveryMaturityDelta' => $recoveryMaturityDelta,
                'recoveryMaturityDrift' => $recoveryMaturityDrift,
                'recoveryMaturityReversalCount' => $recoveryMaturityReversalCount,
                'recoveryMaturityReversalStreak' => $recoveryMaturityReversalStreak,
                'recoveryMaturityStabilityStreak' => $recoveryMaturityStabilityStreak,
                'recoveryMaturityJustReversed' => $recoveryMaturityJustReversed,
                'recoveryMaturityBreakdownRiskScore' => $recoveryMaturityBreakdownRiskScore,
                'recoveryMaturityBreakdownRiskBand' => $recoveryMaturityBreakdownRiskBand,
                'recoveryTrustHealthScore' => $recoveryTrustHealthScore,
                'recoveryTrustHealthBand' => $recoveryTrustHealthBand,
                'recoveryTrustHealthDelta' => $recoveryTrustHealthDelta,
                'recoveryTrustHealthTrend' => $recoveryTrustHealthTrend,
                'recoveryTrustHealthReversalCount' => $recoveryTrustHealthReversalCount,
                'recoveryTrustHealthReversalStreak' => $recoveryTrustHealthReversalStreak,
                'recoveryTrustHealthJustReversed' => $recoveryTrustHealthJustReversed,
            ]));
            $previousRecoveryTrustTopDriver = (string) ($previousRecoveryTopDriver['recoveryTrustTopDriver'] ?? '');
            $previousRecoveryTrustTopDriverAdjustment = intval($previousRecoveryTopDriver['recoveryTrustTopDriverAdjustment'] ?? 0);
            $recoveryTrustTopDriver = (string) ($currentRecoveryTopDriver['recoveryTrustTopDriver'] ?? '');
            $recoveryTrustTopDriverAdjustment = intval($currentRecoveryTopDriver['recoveryTrustTopDriverAdjustment'] ?? 0);
            $recoveryTrustDriverShiftCount = intval($item['recoveryTrustDriverShiftCount'] ?? 0);
            $recoveryTrustDriverShiftStreak = intval($item['recoveryTrustDriverShiftStreak'] ?? 0);
            $recoveryTrustDriverJustShifted = false;
            if ($previousRecoveryTrustTopDriver !== '' && $recoveryTrustTopDriver !== '' && $previousRecoveryTrustTopDriver !== $recoveryTrustTopDriver) {
                $recoveryTrustDriverShiftCount += 1;
                $recoveryTrustDriverShiftStreak += 1;
                $recoveryTrustDriverJustShifted = true;
            } else {
                $recoveryTrustDriverShiftStreak = 0;
            }
            $recoveryTrustDriverTransition = $recoveryTrustDriverJustShifted ? ($previousRecoveryTrustTopDriver . '->' . $recoveryTrustTopDriver) : '';
            $positiveRecoveryDrivers = ['relapse', 'maturity', 'maturity drift', 'maturity stability', 'health', 'health trend'];
            $negativeRecoveryDrivers = ['breakdown risk', 'maturity reversal', 'maturity whipsaw', 'health reversal', 'health whipsaw'];
            $recoveryTrustDriverTransitionSeverityScore = 0;
            if ($recoveryTrustDriverJustShifted) {
                $previousDriverPositive = in_array($previousRecoveryTrustTopDriver, $positiveRecoveryDrivers, true);
                $previousDriverNegative = in_array($previousRecoveryTrustTopDriver, $negativeRecoveryDrivers, true);
                $currentDriverPositive = in_array($recoveryTrustTopDriver, $positiveRecoveryDrivers, true);
                $currentDriverNegative = in_array($recoveryTrustTopDriver, $negativeRecoveryDrivers, true);
                if ($previousDriverNegative && $currentDriverPositive) {
                    $recoveryTrustDriverTransitionSeverityScore = 5;
                } elseif ($previousDriverPositive && $currentDriverNegative) {
                    $recoveryTrustDriverTransitionSeverityScore = -5;
                } elseif ($previousDriverPositive && $currentDriverPositive) {
                    $recoveryTrustDriverTransitionSeverityScore = 1;
                } elseif ($previousDriverNegative && $currentDriverNegative) {
                    $recoveryTrustDriverTransitionSeverityScore = -2;
                } else {
                    $recoveryTrustDriverTransitionSeverityScore = -1;
                }
            }
            $recoveryTrustDriverTransitionSeverityBand = 'neutral';
            if ($recoveryTrustDriverTransitionSeverityScore >= 4) $recoveryTrustDriverTransitionSeverityBand = 'recovery';
            elseif ($recoveryTrustDriverTransitionSeverityScore > 0) $recoveryTrustDriverTransitionSeverityBand = 'stable';
            elseif ($recoveryTrustDriverTransitionSeverityScore <= -5) $recoveryTrustDriverTransitionSeverityBand = 'deteriorating';
            elseif ($recoveryTrustDriverTransitionSeverityScore < 0) $recoveryTrustDriverTransitionSeverityBand = 'risky';
            $recoveryTrustDriverNegativeTransitionCount = intval($item['recoveryTrustDriverNegativeTransitionCount'] ?? 0);
            $recoveryTrustDriverNegativeTransitionStreak = intval($item['recoveryTrustDriverNegativeTransitionStreak'] ?? 0);
            if ($recoveryTrustDriverJustShifted && $recoveryTrustDriverTransitionSeverityScore < 0) {
                $recoveryTrustDriverNegativeTransitionCount += 1;
                $recoveryTrustDriverNegativeTransitionStreak += 1;
            } else {
                $recoveryTrustDriverNegativeTransitionStreak = 0;
            }
            $recoveryTrustDriverPositiveTransitionCount = intval($item['recoveryTrustDriverPositiveTransitionCount'] ?? 0);
            $recoveryTrustDriverPositiveTransitionStreak = intval($item['recoveryTrustDriverPositiveTransitionStreak'] ?? 0);
            if ($recoveryTrustDriverJustShifted && $recoveryTrustDriverTransitionSeverityScore > 0) {
                $recoveryTrustDriverPositiveTransitionCount += 1;
                $recoveryTrustDriverPositiveTransitionStreak += 1;
            } else {
                $recoveryTrustDriverPositiveTransitionStreak = 0;
            }
            $previousRecoveryTrustDriverTransitionBalanceScore = intval($item['recoveryTrustDriverTransitionBalanceScore'] ?? 0);
            $previousRecoveryTrustDriverTransitionBalanceBand = (string) ($item['recoveryTrustDriverTransitionBalanceBand'] ?? 'balanced');
            $recoveryTrustDriverTransitionBalanceScore = $recoveryTrustDriverPositiveTransitionCount - $recoveryTrustDriverNegativeTransitionCount;
            $recoveryTrustDriverTransitionBalanceBand = 'balanced';
            if ($recoveryTrustDriverTransitionBalanceScore >= 2) $recoveryTrustDriverTransitionBalanceBand = 'recovery-led';
            elseif ($recoveryTrustDriverTransitionBalanceScore > 0) $recoveryTrustDriverTransitionBalanceBand = 'slightly recovery-led';
            elseif ($recoveryTrustDriverTransitionBalanceScore <= -2) $recoveryTrustDriverTransitionBalanceBand = 'deterioration-led';
            elseif ($recoveryTrustDriverTransitionBalanceScore < 0) $recoveryTrustDriverTransitionBalanceBand = 'slightly deterioration-led';
            $recoveryTrustDriverTransitionBalanceReversalCount = intval($item['recoveryTrustDriverTransitionBalanceReversalCount'] ?? 0);
            $recoveryTrustDriverTransitionBalanceJustReversed = false;
            $previousRecoveryTrustDriverTransitionBalancePositive = in_array($previousRecoveryTrustDriverTransitionBalanceBand, ['recovery-led', 'slightly recovery-led'], true);
            $previousRecoveryTrustDriverTransitionBalanceNegative = in_array($previousRecoveryTrustDriverTransitionBalanceBand, ['deterioration-led', 'slightly deterioration-led'], true);
            $currentRecoveryTrustDriverTransitionBalancePositive = in_array($recoveryTrustDriverTransitionBalanceBand, ['recovery-led', 'slightly recovery-led'], true);
            $currentRecoveryTrustDriverTransitionBalanceNegative = in_array($recoveryTrustDriverTransitionBalanceBand, ['deterioration-led', 'slightly deterioration-led'], true);
            if (($previousRecoveryTrustDriverTransitionBalancePositive && $currentRecoveryTrustDriverTransitionBalanceNegative)
                || ($previousRecoveryTrustDriverTransitionBalanceNegative && $currentRecoveryTrustDriverTransitionBalancePositive)) {
                $recoveryTrustDriverTransitionBalanceReversalCount += 1;
                $recoveryTrustDriverTransitionBalanceJustReversed = true;
            }
            $recoveryTrustDriverTransitionBalanceReversalStreak = intval($item['recoveryTrustDriverTransitionBalanceReversalStreak'] ?? 0);
            if ($recoveryTrustDriverTransitionBalanceJustReversed) {
                $recoveryTrustDriverTransitionBalanceReversalStreak += 1;
            } else {
                $recoveryTrustDriverTransitionBalanceReversalStreak = 0;
            }
            $recoveryTrustDriverTransitionBalanceStabilityStreak = intval($item['recoveryTrustDriverTransitionBalanceStabilityStreak'] ?? 0);
            if (!$recoveryTrustDriverTransitionBalanceJustReversed && $recoveryTrustDriverTransitionBalanceBand !== 'balanced') {
                if ($previousRecoveryTrustDriverTransitionBalanceBand === $recoveryTrustDriverTransitionBalanceBand) {
                    $recoveryTrustDriverTransitionBalanceStabilityStreak += 1;
                } else {
                    $recoveryTrustDriverTransitionBalanceStabilityStreak = 1;
                }
            } else {
                $recoveryTrustDriverTransitionBalanceStabilityStreak = 0;
            }
            $recoveryTrustDriverTransitionBalanceStabilityPolarity = 'neutral';
            if ($recoveryTrustDriverTransitionBalanceStabilityStreak > 0) {
                if (in_array($recoveryTrustDriverTransitionBalanceBand, ['recovery-led', 'slightly recovery-led'], true)) {
                    $recoveryTrustDriverTransitionBalanceStabilityPolarity = 'recovery';
                } elseif (in_array($recoveryTrustDriverTransitionBalanceBand, ['deterioration-led', 'slightly deterioration-led'], true)) {
                    $recoveryTrustDriverTransitionBalanceStabilityPolarity = 'deterioration';
                }
            }
            $previousRecoveryTrustDriverTransitionBalanceEntrenchmentBand = (string) ($item['recoveryTrustDriverTransitionBalanceEntrenchmentBand'] ?? 'none');
            $recoveryTrustDriverTransitionBalanceEntrenchmentBand = 'none';
            if ($recoveryTrustDriverTransitionBalanceStabilityStreak >= 3 && abs($recoveryTrustDriverTransitionBalanceScore) >= 2) {
                if ($recoveryTrustDriverTransitionBalanceStabilityPolarity === 'recovery') {
                    $recoveryTrustDriverTransitionBalanceEntrenchmentBand = 'recovery-entrenched';
                } elseif ($recoveryTrustDriverTransitionBalanceStabilityPolarity === 'deterioration') {
                    $recoveryTrustDriverTransitionBalanceEntrenchmentBand = 'deterioration-entrenched';
                }
            }
            $recoveryTrustDriverTransitionBalanceEntrenchmentCount = intval($item['recoveryTrustDriverTransitionBalanceEntrenchmentCount'] ?? 0);
            $recoveryTrustDriverTransitionBalanceJustEntrenched = false;
            if ($recoveryTrustDriverTransitionBalanceEntrenchmentBand !== 'none' && $previousRecoveryTrustDriverTransitionBalanceEntrenchmentBand !== $recoveryTrustDriverTransitionBalanceEntrenchmentBand) {
                $recoveryTrustDriverTransitionBalanceEntrenchmentCount += 1;
                $recoveryTrustDriverTransitionBalanceJustEntrenched = true;
            }
            $recoveryTrustDriverTransitionBalanceEscapeCount = intval($item['recoveryTrustDriverTransitionBalanceEscapeCount'] ?? 0);
            $recoveryTrustDriverTransitionBalanceEscapedEntrenchment = false;
            $recoveryTrustDriverTransitionBalanceEntrenchmentEscapeDirection = 'none';
            if ($previousRecoveryTrustDriverTransitionBalanceEntrenchmentBand !== 'none' && $previousRecoveryTrustDriverTransitionBalanceEntrenchmentBand !== $recoveryTrustDriverTransitionBalanceEntrenchmentBand) {
                $recoveryTrustDriverTransitionBalanceEscapeCount += 1;
                $recoveryTrustDriverTransitionBalanceEscapedEntrenchment = true;
                $recoveryTrustDriverTransitionBalanceEntrenchmentEscapeDirection = $previousRecoveryTrustDriverTransitionBalanceEntrenchmentBand === 'deterioration-entrenched' ? 'positive' : 'negative';
            }
            $previousRecoveryTrustDriverTransitionBalanceEscapeDurabilityDirection = (string) ($item['recoveryTrustDriverTransitionBalanceEscapeDurabilityDirection'] ?? 'none');
            $recoveryTrustDriverTransitionBalanceEscapeDurabilityStreak = intval($item['recoveryTrustDriverTransitionBalanceEscapeDurabilityStreak'] ?? 0);
            $recoveryTrustDriverTransitionBalanceEscapeDurabilityDirection = 'none';
            $recoveryTrustDriverTransitionBalanceEscapedEntrenchmentDurably = false;
            $positiveEscapeDurabilityActive = in_array((string) ($item['recoveryTrustDriverTransitionBalanceEntrenchmentEscapeDirection'] ?? 'none'), ['positive'], true) || $previousRecoveryTrustDriverTransitionBalanceEscapeDurabilityDirection === 'positive';
            $negativeEscapeDurabilityActive = in_array((string) ($item['recoveryTrustDriverTransitionBalanceEntrenchmentEscapeDirection'] ?? 'none'), ['negative'], true) || $previousRecoveryTrustDriverTransitionBalanceEscapeDurabilityDirection === 'negative';
            if ($positiveEscapeDurabilityActive
                && $recoveryTrustDriverTransitionBalanceEntrenchmentBand !== 'deterioration-entrenched'
                && !in_array($recoveryTrustDriverTransitionBalanceBand, ['deterioration-led', 'slightly deterioration-led'], true)) {
                $recoveryTrustDriverTransitionBalanceEscapeDurabilityDirection = 'positive';
                $recoveryTrustDriverTransitionBalanceEscapeDurabilityStreak = $previousRecoveryTrustDriverTransitionBalanceEscapeDurabilityDirection === 'positive'
                    ? $recoveryTrustDriverTransitionBalanceEscapeDurabilityStreak + 1
                    : 1;
                $recoveryTrustDriverTransitionBalanceEscapedEntrenchmentDurably = true;
            } elseif ($negativeEscapeDurabilityActive
                && $recoveryTrustDriverTransitionBalanceEntrenchmentBand !== 'recovery-entrenched'
                && !in_array($recoveryTrustDriverTransitionBalanceBand, ['recovery-led', 'slightly recovery-led'], true)) {
                $recoveryTrustDriverTransitionBalanceEscapeDurabilityDirection = 'negative';
                $recoveryTrustDriverTransitionBalanceEscapeDurabilityStreak = $previousRecoveryTrustDriverTransitionBalanceEscapeDurabilityDirection === 'negative'
                    ? $recoveryTrustDriverTransitionBalanceEscapeDurabilityStreak + 1
                    : 1;
                $recoveryTrustDriverTransitionBalanceEscapedEntrenchmentDurably = true;
            } else {
                $recoveryTrustDriverTransitionBalanceEscapeDurabilityStreak = 0;
            }
            $recoveryTrustDriverTransitionBalanceRecaptureCount = intval($item['recoveryTrustDriverTransitionBalanceRecaptureCount'] ?? 0);
            $recoveryTrustDriverTransitionBalanceRecapturedEntrenchment = false;
            $recoveryTrustDriverTransitionBalanceRecaptureDirection = 'none';
            $positiveEscapeRecaptureActive = in_array((string) ($item['recoveryTrustDriverTransitionBalanceEntrenchmentEscapeDirection'] ?? 'none'), ['positive'], true) || $previousRecoveryTrustDriverTransitionBalanceEscapeDurabilityDirection === 'positive';
            $negativeEscapeRecaptureActive = in_array((string) ($item['recoveryTrustDriverTransitionBalanceEntrenchmentEscapeDirection'] ?? 'none'), ['negative'], true) || $previousRecoveryTrustDriverTransitionBalanceEscapeDurabilityDirection === 'negative';
            if ($positiveEscapeRecaptureActive && $recoveryTrustDriverTransitionBalanceEntrenchmentBand === 'deterioration-entrenched') {
                $recoveryTrustDriverTransitionBalanceRecaptureCount += 1;
                $recoveryTrustDriverTransitionBalanceRecapturedEntrenchment = true;
                $recoveryTrustDriverTransitionBalanceRecaptureDirection = 'negative';
            } elseif ($negativeEscapeRecaptureActive && $recoveryTrustDriverTransitionBalanceEntrenchmentBand === 'recovery-entrenched') {
                $recoveryTrustDriverTransitionBalanceRecaptureCount += 1;
                $recoveryTrustDriverTransitionBalanceRecapturedEntrenchment = true;
                $recoveryTrustDriverTransitionBalanceRecaptureDirection = 'positive';
            }
            $recoveryTrustDriverTransitionBalanceRecaptureStreak = intval($item['recoveryTrustDriverTransitionBalanceRecaptureStreak'] ?? 0);
            if ($recoveryTrustDriverTransitionBalanceRecapturedEntrenchment) {
                $recoveryTrustDriverTransitionBalanceRecaptureStreak += 1;
            } elseif ($recoveryTrustDriverTransitionBalanceEscapedEntrenchmentDurably) {
                $recoveryTrustDriverTransitionBalanceRecaptureStreak = 0;
            }
            
            $recoveryTrustDriverTransitionBalanceStructuralState = 'neutral';
            if ($recoveryTrustDriverTransitionBalanceEntrenchmentBand === 'deterioration-entrenched') {
                $recoveryTrustDriverTransitionBalanceStructuralState = ($recoveryTrustDriverTransitionBalanceRecaptureStreak >= 2) ? 'terminal' : 'compromised';
            } elseif ($recoveryTrustDriverTransitionBalanceEntrenchmentBand === 'recovery-entrenched') {
                $recoveryTrustDriverTransitionBalanceStructuralState = 'fortified';
            } elseif ($recoveryTrustDriverTransitionBalanceEscapedEntrenchment && !$recoveryTrustDriverTransitionBalanceEscapedEntrenchmentDurably) {
                $recoveryTrustDriverTransitionBalanceStructuralState = 'contested';
            } elseif ($recoveryTrustDriverTransitionBalanceStabilityStreak >= 2) {
                $recoveryTrustDriverTransitionBalanceStructuralState = ($recoveryTrustDriverTransitionBalanceStabilityPolarity === 'recovery') ? 'sound' : 'weakening';
            } elseif ($recoveryTrustDriverTransitionBalanceBand !== 'balanced') {
                $recoveryTrustDriverTransitionBalanceStructuralState = (in_array($recoveryTrustDriverTransitionBalanceBand, ['recovery-led', 'slightly recovery-led'], true)) ? 'leaning-sound' : 'leaning-weak';
            }

            $previousTrustMomentumScore = intval($item['trustMomentumScore'] ?? 0);
            $previousTrustMomentumBand = (string) ($item['trustMomentumBand'] ?? 'neutral');
            $lastNonNeutralTrustMomentumBand = (string) ($item['lastNonNeutralTrustMomentumBand'] ?? $previousTrustMomentumBand);
            $trustMomentumScore = max(-100, min(100, ($upgradedCount * 12) - ($downgradedCount * 15)));
            $trustMomentumBand = 'neutral';
            if ($trustMomentumScore >= 20) $trustMomentumBand = 'positive';
            elseif ($trustMomentumScore <= -20) $trustMomentumBand = 'negative';
            $trustMomentumReversalCount = intval($item['trustMomentumReversalCount'] ?? 0);
            $trustMomentumReversalStreak = intval($item['trustMomentumReversalStreak'] ?? 0);
            $trustMomentumStabilityStreak = intval($item['trustMomentumStabilityStreak'] ?? 0);
            $trustMomentumJustReversed = false;
            if ($trustMomentumBand !== 'neutral' && $lastNonNeutralTrustMomentumBand !== '' && $lastNonNeutralTrustMomentumBand !== 'neutral' && $lastNonNeutralTrustMomentumBand !== $trustMomentumBand) {
                $trustMomentumReversalCount += 1;
                $trustMomentumReversalStreak += 1;
                $trustMomentumStabilityStreak = 0;
                $trustMomentumJustReversed = true;
            } else {
                $trustMomentumReversalStreak = 0;
                if ($trustMomentumBand !== 'neutral' && $lastNonNeutralTrustMomentumBand === $trustMomentumBand) {
                    $trustMomentumStabilityStreak += 1;
                } elseif ($trustMomentumBand !== 'neutral') {
                    $trustMomentumStabilityStreak = 1;
                } else {
                    $trustMomentumStabilityStreak = 0;
                }
            }
            if ($trustMomentumBand !== 'neutral') {
                $lastNonNeutralTrustMomentumBand = $trustMomentumBand;
            }
            $item['previousBand'] = $item['currentBand'] ?? null;
            $item['baseBand'] = $baseBand;
            $item['currentBand'] = $band;
            $item['previousScore'] = $previousScore;
            $item['previousTrend'] = $previousTrend;
            $item['currentScore'] = $score;
            $item['trend'] = $trend;
            $item['delta'] = $delta;
            $item['trendShiftCount'] = $trendShiftCount;
            $item['volatilityState'] = $volatilityState;
            $item['adjusted'] = $adjusted;
            $item['adjustmentDirection'] = $adjustmentDirection;
            $item['adjustmentCount'] = $adjustmentCount;
            $item['convergenceCount'] = $convergenceCount;
            $item['convergenceStreak'] = $convergenceStreak;
            $item['justConverged'] = $justConverged;
            $item['dependencyCount'] = $dependencyCount;
            $item['dependencyStreak'] = $dependencyStreak;
            $item['justBecameDependent'] = $justBecameDependent;
            $item['dependencyRecoveryCount'] = $dependencyRecoveryCount;
            $item['dependencyRecoveryStreak'] = $dependencyRecoveryStreak;
            $item['justRecoveredFromDependency'] = $justRecoveredFromDependency;
            $item['dependencyRecoveryDurability'] = $dependencyRecoveryDurability;
            $item['durableRecoveryCount'] = $durableRecoveryCount;
            $item['justBecameDurableRecovery'] = $justBecameDurableRecovery;
            $item['durableRecoveryRelapseCount'] = $durableRecoveryRelapseCount;
            $item['justRelapsedFromDurableRecovery'] = $justRelapsedFromDurableRecovery;
            $item['previousRecoveryMaturityScore'] = $previousRecoveryMaturityScore;
            $item['previousRecoveryMaturityBand'] = $previousRecoveryMaturityBand;
            $item['recoveryMaturityScore'] = $recoveryMaturityScore;
            $item['recoveryMaturityBand'] = $recoveryMaturityBand;
            $item['recoveryMaturityDelta'] = $recoveryMaturityDelta;
            $item['recoveryMaturityDrift'] = $recoveryMaturityDrift;
            $item['previousRecoveryMaturityDrift'] = $previousRecoveryMaturityDrift;
            $item['recoveryMaturityReversalCount'] = $recoveryMaturityReversalCount;
            $item['recoveryMaturityReversalStreak'] = $recoveryMaturityReversalStreak;
            $item['recoveryMaturityStabilityStreak'] = $recoveryMaturityStabilityStreak;
            $item['recoveryMaturityJustReversed'] = $recoveryMaturityJustReversed;
            $item['recoveryMaturityBreakdownRiskScore'] = $recoveryMaturityBreakdownRiskScore;
            $item['recoveryMaturityBreakdownRiskBand'] = $recoveryMaturityBreakdownRiskBand;
            $item['previousRecoveryTrustHealthScore'] = $previousRecoveryTrustHealthScore;
            $item['previousRecoveryTrustHealthBand'] = $previousRecoveryTrustHealthBand;
            $item['recoveryTrustHealthScore'] = $recoveryTrustHealthScore;
            $item['recoveryTrustHealthBand'] = $recoveryTrustHealthBand;
            $item['recoveryTrustHealthDelta'] = $recoveryTrustHealthDelta;
            $item['recoveryTrustHealthTrend'] = $recoveryTrustHealthTrend;
            $item['previousRecoveryTrustHealthTrend'] = $previousRecoveryTrustHealthTrend;
            $item['recoveryTrustHealthReversalCount'] = $recoveryTrustHealthReversalCount;
            $item['recoveryTrustHealthReversalStreak'] = $recoveryTrustHealthReversalStreak;
            $item['recoveryTrustHealthJustReversed'] = $recoveryTrustHealthJustReversed;
            $item['previousRecoveryTrustTopDriver'] = $previousRecoveryTrustTopDriver;
            $item['previousRecoveryTrustTopDriverAdjustment'] = $previousRecoveryTrustTopDriverAdjustment;
            $item['recoveryTrustTopDriver'] = $recoveryTrustTopDriver;
            $item['recoveryTrustTopDriverAdjustment'] = $recoveryTrustTopDriverAdjustment;
            $item['recoveryTrustDriverShiftCount'] = $recoveryTrustDriverShiftCount;
            $item['recoveryTrustDriverShiftStreak'] = $recoveryTrustDriverShiftStreak;
            $item['recoveryTrustDriverJustShifted'] = $recoveryTrustDriverJustShifted;
            $item['recoveryTrustDriverTransition'] = $recoveryTrustDriverTransition;
            $item['recoveryTrustDriverTransitionSeverityScore'] = $recoveryTrustDriverTransitionSeverityScore;
            $item['recoveryTrustDriverTransitionSeverityBand'] = $recoveryTrustDriverTransitionSeverityBand;
            $item['recoveryTrustDriverNegativeTransitionCount'] = $recoveryTrustDriverNegativeTransitionCount;
            $item['recoveryTrustDriverNegativeTransitionStreak'] = $recoveryTrustDriverNegativeTransitionStreak;
            $item['recoveryTrustDriverPositiveTransitionCount'] = $recoveryTrustDriverPositiveTransitionCount;
            $item['recoveryTrustDriverPositiveTransitionStreak'] = $recoveryTrustDriverPositiveTransitionStreak;
            $item['previousRecoveryTrustDriverTransitionBalanceScore'] = $previousRecoveryTrustDriverTransitionBalanceScore;
            $item['previousRecoveryTrustDriverTransitionBalanceBand'] = $previousRecoveryTrustDriverTransitionBalanceBand;
            $item['recoveryTrustDriverTransitionBalanceScore'] = $recoveryTrustDriverTransitionBalanceScore;
            $item['recoveryTrustDriverTransitionBalanceBand'] = $recoveryTrustDriverTransitionBalanceBand;
            $item['recoveryTrustDriverTransitionBalanceReversalCount'] = $recoveryTrustDriverTransitionBalanceReversalCount;
            $item['recoveryTrustDriverTransitionBalanceJustReversed'] = $recoveryTrustDriverTransitionBalanceJustReversed;
            $item['recoveryTrustDriverTransitionBalanceReversalStreak'] = $recoveryTrustDriverTransitionBalanceReversalStreak;
            $item['recoveryTrustDriverTransitionBalanceStabilityStreak'] = $recoveryTrustDriverTransitionBalanceStabilityStreak;
            $item['recoveryTrustDriverTransitionBalanceStabilityPolarity'] = $recoveryTrustDriverTransitionBalanceStabilityPolarity;
            $item['previousRecoveryTrustDriverTransitionBalanceEntrenchmentBand'] = $previousRecoveryTrustDriverTransitionBalanceEntrenchmentBand;
            $item['recoveryTrustDriverTransitionBalanceEntrenchmentBand'] = $recoveryTrustDriverTransitionBalanceEntrenchmentBand;
            $item['recoveryTrustDriverTransitionBalanceEntrenchmentCount'] = $recoveryTrustDriverTransitionBalanceEntrenchmentCount;
            $item['recoveryTrustDriverTransitionBalanceJustEntrenched'] = $recoveryTrustDriverTransitionBalanceJustEntrenched;
            $item['recoveryTrustDriverTransitionBalanceEscapeCount'] = $recoveryTrustDriverTransitionBalanceEscapeCount;
            $item['recoveryTrustDriverTransitionBalanceEscapedEntrenchment'] = $recoveryTrustDriverTransitionBalanceEscapedEntrenchment;
            $item['recoveryTrustDriverTransitionBalanceEntrenchmentEscapeDirection'] = $recoveryTrustDriverTransitionBalanceEntrenchmentEscapeDirection;
            $item['previousRecoveryTrustDriverTransitionBalanceEscapeDurabilityDirection'] = $previousRecoveryTrustDriverTransitionBalanceEscapeDurabilityDirection;
            $item['recoveryTrustDriverTransitionBalanceEscapeDurabilityStreak'] = $recoveryTrustDriverTransitionBalanceEscapeDurabilityStreak;
            $item['recoveryTrustDriverTransitionBalanceEscapeDurabilityDirection'] = $recoveryTrustDriverTransitionBalanceEscapeDurabilityDirection;
            $item['recoveryTrustDriverTransitionBalanceEscapedEntrenchmentDurably'] = $recoveryTrustDriverTransitionBalanceEscapedEntrenchmentDurably;
            $item['recoveryTrustDriverTransitionBalanceRecaptureCount'] = $recoveryTrustDriverTransitionBalanceRecaptureCount;
            $item['recoveryTrustDriverTransitionBalanceRecapturedEntrenchment'] = $recoveryTrustDriverTransitionBalanceRecapturedEntrenchment;
            $item['recoveryTrustDriverTransitionBalanceRecaptureDirection'] = $recoveryTrustDriverTransitionBalanceRecaptureDirection;
            $item['recoveryTrustDriverTransitionBalanceRecaptureStreak'] = $recoveryTrustDriverTransitionBalanceRecaptureStreak;
            $item['recoveryTrustDriverTransitionBalanceStructuralState'] = $recoveryTrustDriverTransitionBalanceStructuralState;
            $item['upgradedCount'] = $upgradedCount;
            $item['downgradedCount'] = $downgradedCount;
            $item['previousTrustMomentumScore'] = $previousTrustMomentumScore;
            $item['previousTrustMomentumBand'] = $previousTrustMomentumBand;
            $item['trustMomentumScore'] = $trustMomentumScore;
            $item['trustMomentumBand'] = $trustMomentumBand;
            $item['lastNonNeutralTrustMomentumBand'] = $lastNonNeutralTrustMomentumBand;
            $item['trustMomentumReversalCount'] = $trustMomentumReversalCount;
            $item['trustMomentumReversalStreak'] = $trustMomentumReversalStreak;
            $item['trustMomentumStabilityStreak'] = $trustMomentumStabilityStreak;
            $item['trustMomentumJustReversed'] = $trustMomentumJustReversed;
            $item['updatedAt'] = gmdate('c');
            $found = true;
            break;
        }
    }
    unset($item);

    if (!$found) {
        $initialAdjusted = $baseBand !== $band;
        $initialRank = ['low' => 0, 'guarded' => 1, 'medium' => 2, 'high' => 3];
        $initialDirection = ($initialAdjusted && (($initialRank[$band] ?? 0) > ($initialRank[$baseBand] ?? 0))) ? 'upgraded' : ($initialAdjusted ? 'downgraded' : 'none');
        $initialUpgradedCount = $initialDirection === 'upgraded' ? 1 : 0;
        $initialDowngradedCount = $initialDirection === 'downgraded' ? 1 : 0;
        $initialTrustMomentumScore = max(-100, min(100, ($initialUpgradedCount * 12) - ($initialDowngradedCount * 15)));
        $initialTrustMomentumBand = 'neutral';
        if ($initialTrustMomentumScore >= 20) $initialTrustMomentumBand = 'positive';
        elseif ($initialTrustMomentumScore <= -20) $initialTrustMomentumBand = 'negative';
        $payload['items'][] = [
            'action' => $action,
            'previousBand' => null,
            'baseBand' => $baseBand,
            'currentBand' => $band,
            'previousScore' => null,
            'previousTrend' => null,
            'currentScore' => $score,
            'trend' => 'steady',
            'delta' => 0,
            'trendShiftCount' => 0,
            'volatilityState' => 'low',
            'adjusted' => $initialAdjusted,
            'adjustmentDirection' => $initialDirection,
            'adjustmentCount' => $initialAdjusted ? 1 : 0,
            'convergenceCount' => 0,
            'convergenceStreak' => 0,
            'justConverged' => false,
            'dependencyCount' => $initialAdjusted ? 1 : 0,
            'dependencyStreak' => $initialAdjusted ? 1 : 0,
            'justBecameDependent' => $initialAdjusted,
            'dependencyRecoveryCount' => 0,
            'dependencyRecoveryStreak' => 0,
            'justRecoveredFromDependency' => false,
            'dependencyRecoveryDurability' => 'fragile',
            'durableRecoveryCount' => 0,
            'justBecameDurableRecovery' => false,
            'durableRecoveryRelapseCount' => 0,
            'justRelapsedFromDurableRecovery' => false,
            'previousRecoveryMaturityScore' => 0,
            'previousRecoveryMaturityBand' => 'early',
            'recoveryMaturityScore' => 0,
            'recoveryMaturityBand' => 'early',
            'recoveryMaturityDelta' => 0,
            'recoveryMaturityDrift' => 'steady',
            'previousRecoveryMaturityDrift' => 'steady',
            'recoveryMaturityReversalCount' => 0,
            'recoveryMaturityReversalStreak' => 0,
            'recoveryMaturityStabilityStreak' => 0,
            'recoveryMaturityJustReversed' => false,
            'recoveryMaturityBreakdownRiskScore' => 0,
            'recoveryMaturityBreakdownRiskBand' => 'low',
            'previousRecoveryTrustHealthScore' => 0,
            'previousRecoveryTrustHealthBand' => 'fragile',
            'recoveryTrustHealthScore' => 0,
            'recoveryTrustHealthBand' => 'fragile',
            'recoveryTrustHealthDelta' => 0,
            'recoveryTrustHealthTrend' => 'steady',
            'previousRecoveryTrustHealthTrend' => 'steady',
            'recoveryTrustHealthReversalCount' => 0,
            'recoveryTrustHealthReversalStreak' => 0,
            'recoveryTrustHealthJustReversed' => false,
            'upgradedCount' => $initialUpgradedCount,
            'downgradedCount' => $initialDowngradedCount,
            'previousTrustMomentumScore' => 0,
            'previousTrustMomentumBand' => 'neutral',
            'trustMomentumScore' => $initialTrustMomentumScore,
            'trustMomentumBand' => $initialTrustMomentumBand,
            'lastNonNeutralTrustMomentumBand' => $initialTrustMomentumBand,
            'trustMomentumReversalCount' => 0,
            'trustMomentumReversalStreak' => 0,
            'trustMomentumStabilityStreak' => $initialTrustMomentumBand !== 'neutral' ? 1 : 0,
            'trustMomentumJustReversed' => false,
            'updatedAt' => gmdate('c')
        ];
    }
}

usort($payload['items'], function ($a, $b) {
    return intval($b['trendShiftCount'] ?? 0) <=> intval($a['trendShiftCount'] ?? 0)
        ?: abs(floatval($b['delta'] ?? 0)) <=> abs(floatval($a['delta'] ?? 0))
        ?: strcmp((string) ($b['updatedAt'] ?? ''), (string) ($a['updatedAt'] ?? ''));
});

file_put_contents($path, json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");

echo json_encode(['ok' => true, 'items' => $payload['items']]);
