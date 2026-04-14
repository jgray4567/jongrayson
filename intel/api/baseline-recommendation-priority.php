<?php
header('Content-Type: application/json');
header('Cache-Control: no-store');

require_once __DIR__ . '/lib/recovery-trust.php';

$analyticsPath = dirname(__DIR__) . '/data/baseline-recommendation-analytics.json';
$outcomesPath = dirname(__DIR__) . '/data/baseline-recommendation-outcomes.json';
$revivalsPath = dirname(__DIR__) . '/data/baseline-recommendation-revivals.json';
$churnPath = dirname(__DIR__) . '/data/baseline-recommendation-churn.json';
$confidenceHistoryPath = dirname(__DIR__) . '/data/baseline-recommendation-confidence-history.json';
$analyticsPayload = file_exists($analyticsPath) ? json_decode(file_get_contents($analyticsPath), true) : ['items' => []];
$outcomesPayload = file_exists($outcomesPath) ? json_decode(file_get_contents($outcomesPath), true) : ['items' => []];
$revivalsPayload = file_exists($revivalsPath) ? json_decode(file_get_contents($revivalsPath), true) : ['items' => []];
$churnPayload = file_exists($churnPath) ? json_decode(file_get_contents($churnPath), true) : ['items' => []];
$confidenceHistoryPayload = file_exists($confidenceHistoryPath) ? json_decode(file_get_contents($confidenceHistoryPath), true) : ['items' => []];
$analyticsItems = is_array($analyticsPayload['items'] ?? null) ? $analyticsPayload['items'] : [];
$outcomeItems = is_array($outcomesPayload['items'] ?? null) ? $outcomesPayload['items'] : [];
$revivalItems = is_array($revivalsPayload['items'] ?? null) ? $revivalsPayload['items'] : [];
$churnItems = is_array($churnPayload['items'] ?? null) ? $churnPayload['items'] : [];
$confidenceHistoryItems = is_array($confidenceHistoryPayload['items'] ?? null) ? $confidenceHistoryPayload['items'] : [];

$input = json_decode(file_get_contents('php://input'), true);
$items = is_array($input['items'] ?? null) ? $input['items'] : [];
if (!$items) {
    http_response_code(400);
    echo json_encode(['error' => 'recommendation_items_required']);
    exit;
}

$analyticsByAction = [];
foreach ($analyticsItems as $item) {
    $analyticsByAction[$item['action'] ?? ''] = $item;
}

$outcomesByAction = [];
foreach ($outcomeItems as $item) {
    $outcomesByAction[$item['action'] ?? ''] = $item;
}

$revivalsByAction = [];
foreach ($revivalItems as $item) {
    $action = $item['action'] ?? '';
    if ($action === '') continue;
    if (!isset($revivalsByAction[$action]) || strcmp((string) ($item['revivedAt'] ?? ''), (string) ($revivalsByAction[$action]['revivedAt'] ?? '')) > 0) {
        $revivalsByAction[$action] = $item;
    }
}

$churnByAction = [];
foreach ($churnItems as $item) {
    $action = $item['action'] ?? '';
    if ($action === '') continue;
    $churnByAction[$action] = $item;
}

$confidenceHistoryByAction = [];
foreach ($confidenceHistoryItems as $item) {
    $action = $item['action'] ?? '';
    if ($action === '') continue;
    $confidenceHistoryByAction[$action] = $item;
}

$priorityRank = ['promote' => 6, 'revived' => 5, 'watch' => 4, 'default' => 3, 'new' => 2, 'caution' => 1, 'suppressed' => 0];
$prioritized = array_map(function ($item) use ($analyticsByAction, $outcomesByAction, $revivalsByAction, $churnByAction, $confidenceHistoryByAction) {
    $action = trim((string) ($item['action'] ?? ''));
    $analytics = $analyticsByAction[$action] ?? [];
    $outcomes = $outcomesByAction[$action] ?? [];
    $revival = $revivalsByAction[$action] ?? [];
    $churn = $churnByAction[$action] ?? [];
    $confidenceHistory = $confidenceHistoryByAction[$action] ?? [];
    $acceptedCount = intval($analytics['acceptedCount'] ?? 0);
    $surfacedCount = intval($analytics['surfacedCount'] ?? 0);
    $acceptanceRate = $surfacedCount > 0 ? round($acceptedCount / $surfacedCount, 2) : 0;
    $positiveCount = intval($outcomes['positiveCount'] ?? 0);
    $negativeCount = intval($outcomes['negativeCount'] ?? 0);
    $outcomeScore = intval($outcomes['positiveCount'] ?? 0) - intval($outcomes['negativeCount'] ?? 0);
    $lastOutcomeAt = $outcomes['lastOutcomeAt'] ?? null;
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
    $playbookConfidence = 'none';
    $playbookBoost = 0;
    if (($positiveCount >= 3 && $freshness === 'fresh') || $playbookScore >= 80) {
        $playbookConfidence = 'proven';
        $playbookBoost = 30;
    } elseif (($positiveCount >= 2 && $freshness !== 'stale') || $playbookScore >= 40) {
        $playbookConfidence = 'strong';
        $playbookBoost = 15;
    } elseif ($positiveCount >= 1 || $playbookScore > 0) {
        $playbookConfidence = 'emerging';
        $playbookBoost = 5;
    }
    $revivalStatus = $revival['status'] ?? null;
    $revivalBoost = 0;
    if ($revivalStatus === 'sticking') $revivalBoost = 20;
    elseif ($revivalStatus === 'active') $revivalBoost = 8;
    elseif ($revivalStatus === 'failed') $revivalBoost = -20;
    $changeCount = intval($churn['changeCount'] ?? 0);
    $lastChangedAt = $churn['lastChangedAt'] ?? null;
    $lastChangedTs = $lastChangedAt ? strtotime((string) $lastChangedAt) : 0;
    $stabilityAgeHours = $lastChangedTs ? round(max(0, time() - $lastChangedTs) / 3600, 1) : 0;
    $stabilityState = 'new';
    $stableBoost = 0;
    if ($changeCount === 0 && $stabilityAgeHours >= 6) {
        $stabilityState = 'stable';
        $stableBoost = 20;
    } elseif ($changeCount <= 1 && $stabilityAgeHours >= 3) {
        $stabilityState = 'settling';
        $stableBoost = 10;
    } elseif ($changeCount >= 3) {
        $stabilityState = 'volatile';
    }
    $churnPenalty = 0;
    if ($changeCount >= 5) $churnPenalty = -30;
    elseif ($changeCount >= 3) $churnPenalty = -15;
    elseif ($changeCount >= 1) $churnPenalty = -5;
    $volatilityState = $confidenceHistory['volatilityState'] ?? 'low';
    $trendShiftCount = intval($confidenceHistory['trendShiftCount'] ?? 0);
    $volatilityPenalty = 0;
    if ($volatilityState === 'high') $volatilityPenalty = -20;
    elseif ($volatilityState === 'medium') $volatilityPenalty = -8;
    $volatilityBoost = 0;
    if ($volatilityState === 'low' && $trendShiftCount === 0) $volatilityBoost = 10;
    elseif ($volatilityState === 'low') $volatilityBoost = 5;
    $downgradedCount = intval($confidenceHistory['downgradedCount'] ?? 0);
    $upgradedCount = intval($confidenceHistory['upgradedCount'] ?? 0);
    $upgradeDowngradePenalty = 0;
    if ($downgradedCount >= 3) $upgradeDowngradePenalty = -20;
    elseif ($downgradedCount >= 1) $upgradeDowngradePenalty = -8;
    $upgradeConfirmationBoost = 0;
    if ($upgradedCount >= 3) $upgradeConfirmationBoost = 15;
    elseif ($upgradedCount >= 1) $upgradeConfirmationBoost = 6;
    $trustMomentumScore = max(-100, min(100, ($upgradedCount * 12) - ($downgradedCount * 15)));
    $trustMomentumBand = 'neutral';
    if ($trustMomentumScore >= 20) $trustMomentumBand = 'positive';
    elseif ($trustMomentumScore <= -20) $trustMomentumBand = 'negative';
    $trustMomentumAdjustment = 0;
    if ($trustMomentumBand === 'positive') $trustMomentumAdjustment = 10;
    elseif ($trustMomentumBand === 'negative') $trustMomentumAdjustment = -10;
    $trustMomentumReversalCount = intval($confidenceHistory['trustMomentumReversalCount'] ?? 0);
    $trustMomentumReversalStreak = intval($confidenceHistory['trustMomentumReversalStreak'] ?? 0);
    $trustMomentumStabilityStreak = intval($confidenceHistory['trustMomentumStabilityStreak'] ?? 0);
    $trustMomentumJustReversed = !empty($confidenceHistory['trustMomentumJustReversed']);
    $trustMomentumReversalAdjustment = 0;
    if ($trustMomentumJustReversed && $trustMomentumBand === 'positive') $trustMomentumReversalAdjustment = 8;
    elseif ($trustMomentumJustReversed && $trustMomentumBand === 'negative') $trustMomentumReversalAdjustment = -12;
    $trustMomentumReversalStreakAdjustment = 0;
    if ($trustMomentumReversalStreak >= 2) $trustMomentumReversalStreakAdjustment = -15;
    elseif ($trustMomentumReversalStreak >= 1) $trustMomentumReversalStreakAdjustment = -6;
    $trustMomentumStabilityBoost = 0;
    if ($trustMomentumStabilityStreak >= 4) $trustMomentumStabilityBoost = 12;
    elseif ($trustMomentumStabilityStreak >= 2) $trustMomentumStabilityBoost = 6;
    $priorityScore = round(($acceptanceRate * 100) + ($acceptedCount * 5) + ($outcomeScore * 20) + $playbookBoost + $revivalBoost + $stableBoost + $churnPenalty + $volatilityPenalty + $volatilityBoost + $upgradeDowngradePenalty + $upgradeConfirmationBoost + $trustMomentumAdjustment + $trustMomentumReversalAdjustment + $trustMomentumReversalStreakAdjustment + $trustMomentumStabilityBoost, 2);
    $promotion = 'default';
    $suppressed = false;
    $revived = false;
    if ($surfacedCount === 0) $promotion = 'new';
    elseif ($freshness === 'fresh' && ($outcomes['lastOutcome'] ?? '') === 'positive' && $negativeCount >= 2 && $outcomeScore >= 0) {
        $promotion = 'revived';
        $revived = true;
        $priorityScore = round($priorityScore + 10, 2);
    }
    elseif ($outcomeScore <= -2 || $negativeCount >= 2) {
        $promotion = 'suppressed';
        $suppressed = true;
    }
    elseif ($outcomeScore < 0) $promotion = 'caution';
    elseif ($outcomeScore > 0 || ($acceptanceRate >= 0.4 && $acceptedCount >= 1)) $promotion = 'promote';
    elseif ($acceptanceRate > 0.1 || $acceptedCount >= 1) $promotion = 'watch';
    $confidenceBand = 'low';
    if (!$suppressed) {
        if ($priorityScore >= 130 && $outcomeScore >= 0 && $churnPenalty >= -5) $confidenceBand = 'high';
        elseif ($priorityScore >= 70) $confidenceBand = 'medium';
        elseif ($priorityScore >= 30) $confidenceBand = 'guarded';
    }
    $trendBonus = ($confidenceHistory['trend'] ?? '') === 'rising' ? 10 : (($confidenceHistory['trend'] ?? '') === 'steady' ? 5 : -10);
    $resilienceScore = round(max(0, min(100, 50 + $trendBonus + $stableBoost + $volatilityBoost + ($playbookBoost / 2) + ($revivalBoost / 2) + $churnPenalty + $volatilityPenalty)), 2);
    $resilienceBand = 'fragile';
    if ($resilienceScore >= 70) $resilienceBand = 'durable';
    elseif ($resilienceScore >= 50) $resilienceBand = 'steady';
    $baseConfidenceBand = $confidenceBand;
    if (!$suppressed) {
        if ($resilienceBand === 'durable') {
            if ($confidenceBand === 'guarded') $confidenceBand = 'medium';
            elseif ($confidenceBand === 'medium' && $priorityScore >= 100) $confidenceBand = 'high';
        } elseif ($resilienceBand === 'fragile') {
            if ($confidenceBand === 'high') $confidenceBand = 'medium';
            elseif ($confidenceBand === 'medium') $confidenceBand = 'guarded';
            elseif ($confidenceBand === 'guarded') $confidenceBand = 'low';
        }
    }
    $convergenceCount = intval($confidenceHistory['convergenceCount'] ?? 0);
    $convergenceStreak = intval($confidenceHistory['convergenceStreak'] ?? 0);
    $justConverged = !empty($confidenceHistory['justConverged']);
    $convergenceBoost = 0;
    if ($convergenceStreak >= 3) $convergenceBoost = 10;
    elseif ($convergenceStreak >= 1) $convergenceBoost = 5;
    $dependencyCount = intval($confidenceHistory['dependencyCount'] ?? 0);
    $dependencyStreak = intval($confidenceHistory['dependencyStreak'] ?? 0);
    $justBecameDependent = !empty($confidenceHistory['justBecameDependent']);
    $dependencyPenalty = 0;
    if ($dependencyStreak >= 4) $dependencyPenalty = -12;
    elseif ($dependencyStreak >= 2) $dependencyPenalty = -5;
    $dependencyRecoveryCount = intval($confidenceHistory['dependencyRecoveryCount'] ?? 0);
    $dependencyRecoveryStreak = intval($confidenceHistory['dependencyRecoveryStreak'] ?? 0);
    $justRecoveredFromDependency = !empty($confidenceHistory['justRecoveredFromDependency']);
    $dependencyRecoveryBoost = 0;
    if ($dependencyRecoveryStreak >= 3) $dependencyRecoveryBoost = 10;
    elseif ($dependencyRecoveryStreak >= 1) $dependencyRecoveryBoost = 5;
    $dependencyRecoveryDurability = (string) ($confidenceHistory['dependencyRecoveryDurability'] ?? 'fragile');
    $durableRecoveryCount = intval($confidenceHistory['durableRecoveryCount'] ?? 0);
    $justBecameDurableRecovery = !empty($confidenceHistory['justBecameDurableRecovery']);
    $dependencyRecoveryDurabilityBoost = $dependencyRecoveryDurability === 'durable' ? 8 : 0;
    $durableRecoveryRelapseCount = intval($confidenceHistory['durableRecoveryRelapseCount'] ?? 0);
    $justRelapsedFromDurableRecovery = !empty($confidenceHistory['justRelapsedFromDurableRecovery']);
    $durableRecoveryRelapsePenalty = $justRelapsedFromDurableRecovery ? -10 : 0;
    $recovery = intel_compute_recovery_trust_metrics($confidenceHistory);
    extract($recovery);
    $previousRecoveryTrustTopDriver = (string) ($confidenceHistory['previousRecoveryTrustTopDriver'] ?? '');
    $recoveryTrustDriverShiftCount = intval($confidenceHistory['recoveryTrustDriverShiftCount'] ?? 0);
    $recoveryTrustDriverShiftStreak = intval($confidenceHistory['recoveryTrustDriverShiftStreak'] ?? 0);
    $recoveryTrustDriverJustShifted = !empty($confidenceHistory['recoveryTrustDriverJustShifted']);
    $recoveryTrustDriverTransition = (string) ($confidenceHistory['recoveryTrustDriverTransition'] ?? '');
    $recoveryTrustDriverTransitionSeverityScore = intval($confidenceHistory['recoveryTrustDriverTransitionSeverityScore'] ?? 0);
    $recoveryTrustDriverTransitionSeverityBand = (string) ($confidenceHistory['recoveryTrustDriverTransitionSeverityBand'] ?? 'neutral');
    $recoveryTrustDriverNegativeTransitionCount = intval($confidenceHistory['recoveryTrustDriverNegativeTransitionCount'] ?? 0);
    $recoveryTrustDriverNegativeTransitionStreak = intval($confidenceHistory['recoveryTrustDriverNegativeTransitionStreak'] ?? 0);
    $recoveryTrustDriverPositiveTransitionCount = intval($confidenceHistory['recoveryTrustDriverPositiveTransitionCount'] ?? 0);
    $recoveryTrustDriverPositiveTransitionStreak = intval($confidenceHistory['recoveryTrustDriverPositiveTransitionStreak'] ?? 0);
    $recoveryTrustDriverTransitionBalanceScore = intval($confidenceHistory['recoveryTrustDriverTransitionBalanceScore'] ?? 0);
    $recoveryTrustDriverTransitionBalanceBand = (string) ($confidenceHistory['recoveryTrustDriverTransitionBalanceBand'] ?? 'balanced');
    $previousRecoveryTrustDriverTransitionBalanceScore = intval($confidenceHistory['previousRecoveryTrustDriverTransitionBalanceScore'] ?? 0);
    $previousRecoveryTrustDriverTransitionBalanceBand = (string) ($confidenceHistory['previousRecoveryTrustDriverTransitionBalanceBand'] ?? 'balanced');
    $recoveryTrustDriverTransitionBalanceReversalCount = intval($confidenceHistory['recoveryTrustDriverTransitionBalanceReversalCount'] ?? 0);
    $recoveryTrustDriverTransitionBalanceJustReversed = !empty($confidenceHistory['recoveryTrustDriverTransitionBalanceJustReversed']);
    $recoveryTrustDriverTransitionBalanceReversalStreak = intval($confidenceHistory['recoveryTrustDriverTransitionBalanceReversalStreak'] ?? 0);
    $recoveryTrustDriverTransitionBalanceStabilityStreak = intval($confidenceHistory['recoveryTrustDriverTransitionBalanceStabilityStreak'] ?? 0);
    $recoveryTrustDriverTransitionBalanceStabilityPolarity = (string) ($confidenceHistory['recoveryTrustDriverTransitionBalanceStabilityPolarity'] ?? 'neutral');
    $previousRecoveryTrustDriverTransitionBalanceEntrenchmentBand = (string) ($confidenceHistory['previousRecoveryTrustDriverTransitionBalanceEntrenchmentBand'] ?? 'none');
    $recoveryTrustDriverTransitionBalanceEntrenchmentBand = (string) ($confidenceHistory['recoveryTrustDriverTransitionBalanceEntrenchmentBand'] ?? 'none');
    $recoveryTrustDriverTransitionBalanceEntrenchmentCount = intval($confidenceHistory['recoveryTrustDriverTransitionBalanceEntrenchmentCount'] ?? 0);
    $recoveryTrustDriverTransitionBalanceJustEntrenched = !empty($confidenceHistory['recoveryTrustDriverTransitionBalanceJustEntrenched']);
    $recoveryTrustDriverTransitionBalanceEscapeCount = intval($confidenceHistory['recoveryTrustDriverTransitionBalanceEscapeCount'] ?? 0);
    $recoveryTrustDriverTransitionBalanceEscapedEntrenchment = !empty($confidenceHistory['recoveryTrustDriverTransitionBalanceEscapedEntrenchment']);
    $recoveryTrustDriverTransitionBalanceEntrenchmentEscapeDirection = (string) ($confidenceHistory['recoveryTrustDriverTransitionBalanceEntrenchmentEscapeDirection'] ?? 'none');
    $previousRecoveryTrustDriverTransitionBalanceEscapeDurabilityDirection = (string) ($confidenceHistory['previousRecoveryTrustDriverTransitionBalanceEscapeDurabilityDirection'] ?? 'none');
    $recoveryTrustDriverTransitionBalanceEscapeDurabilityStreak = intval($confidenceHistory['recoveryTrustDriverTransitionBalanceEscapeDurabilityStreak'] ?? 0);
    $recoveryTrustDriverTransitionBalanceEscapeDurabilityDirection = (string) ($confidenceHistory['recoveryTrustDriverTransitionBalanceEscapeDurabilityDirection'] ?? 'none');
    $recoveryTrustDriverTransitionBalanceEscapedEntrenchmentDurably = !empty($confidenceHistory['recoveryTrustDriverTransitionBalanceEscapedEntrenchmentDurably']);
    $recoveryTrustDriverTransitionBalanceRecaptureCount = intval($confidenceHistory['recoveryTrustDriverTransitionBalanceRecaptureCount'] ?? 0);
    $recoveryTrustDriverTransitionBalanceRecapturedEntrenchment = !empty($confidenceHistory['recoveryTrustDriverTransitionBalanceRecapturedEntrenchment']);
    $recoveryTrustDriverTransitionBalanceRecaptureDirection = (string) ($confidenceHistory['recoveryTrustDriverTransitionBalanceRecaptureDirection'] ?? 'none');
    $recoveryTrustDriverTransitionBalanceRecaptureStreak = intval($confidenceHistory['recoveryTrustDriverTransitionBalanceRecaptureStreak'] ?? 0);
    $recoveryTrustDriverTransitionBalanceStructuralState = (string) ($confidenceHistory['recoveryTrustDriverTransitionBalanceStructuralState'] ?? 'neutral');
    $recoveryTrustDriverShiftAdjustment = 0;
    if ($recoveryTrustDriverJustShifted) {
        $recoveryTrustDriverShiftAdjustment = in_array($recoveryTrustTopDriver, ['breakdown risk', 'health reversal', 'health whipsaw', 'maturity reversal', 'maturity whipsaw'], true) ? -7 : -4;
    }
    $recoveryTrustDriverShiftStreakAdjustment = $recoveryTrustDriverShiftStreak > 0 ? -min(9, $recoveryTrustDriverShiftStreak * 3) : 0;
    $recoveryTrustDriverTransitionAdjustment = $recoveryTrustDriverTransitionSeverityScore;
    $recoveryTrustDriverNegativeTransitionStreakAdjustment = $recoveryTrustDriverNegativeTransitionStreak > 0 ? -min(9, $recoveryTrustDriverNegativeTransitionStreak * 3) : 0;
    $recoveryTrustDriverPositiveTransitionStreakBoost = $recoveryTrustDriverPositiveTransitionStreak > 0 ? min(9, $recoveryTrustDriverPositiveTransitionStreak * 3) : 0;
    $recoveryTrustDriverTransitionBalanceAdjustment = max(-6, min(6, $recoveryTrustDriverTransitionBalanceScore * 2));
    $recoveryTrustDriverTransitionBalanceReversalAdjustment = 0;
    if ($recoveryTrustDriverTransitionBalanceJustReversed) {
        $recoveryTrustDriverTransitionBalanceReversalAdjustment = in_array($recoveryTrustDriverTransitionBalanceBand, ['recovery-led', 'slightly recovery-led'], true) ? 4 : -6;
    }
    $recoveryTrustDriverTransitionBalanceReversalStreakAdjustment = $recoveryTrustDriverTransitionBalanceReversalStreak > 0 ? -min(9, $recoveryTrustDriverTransitionBalanceReversalStreak * 3) : 0;
    $recoveryTrustDriverTransitionBalanceStabilityAdjustment = 0;
    if ($recoveryTrustDriverTransitionBalanceStabilityStreak > 0) {
        $recoveryTrustDriverTransitionBalanceStabilityMagnitude = min(9, $recoveryTrustDriverTransitionBalanceStabilityStreak * 3);
        if ($recoveryTrustDriverTransitionBalanceStabilityPolarity === 'recovery') {
            $recoveryTrustDriverTransitionBalanceStabilityAdjustment = $recoveryTrustDriverTransitionBalanceStabilityMagnitude;
        } elseif ($recoveryTrustDriverTransitionBalanceStabilityPolarity === 'deterioration') {
            $recoveryTrustDriverTransitionBalanceStabilityAdjustment = -$recoveryTrustDriverTransitionBalanceStabilityMagnitude;
        }
    }
    $recoveryTrustDriverTransitionBalanceEntrenchmentAdjustment = 0;
    if ($recoveryTrustDriverTransitionBalanceEntrenchmentBand === 'recovery-entrenched') {
        $recoveryTrustDriverTransitionBalanceEntrenchmentAdjustment = 6;
    } elseif ($recoveryTrustDriverTransitionBalanceEntrenchmentBand === 'deterioration-entrenched') {
        $recoveryTrustDriverTransitionBalanceEntrenchmentAdjustment = -8;
    }
    $recoveryTrustDriverTransitionBalanceEntrenchmentEscapeAdjustment = 0;
    if ($recoveryTrustDriverTransitionBalanceEscapedEntrenchment) {
        if ($recoveryTrustDriverTransitionBalanceEntrenchmentEscapeDirection === 'positive') {
            $recoveryTrustDriverTransitionBalanceEntrenchmentEscapeAdjustment = 6;
        } elseif ($recoveryTrustDriverTransitionBalanceEntrenchmentEscapeDirection === 'negative') {
            $recoveryTrustDriverTransitionBalanceEntrenchmentEscapeAdjustment = -4;
        }
    }
    $recoveryTrustDriverTransitionBalanceEscapeDurabilityAdjustment = 0;
    if ($recoveryTrustDriverTransitionBalanceEscapedEntrenchmentDurably) {
        $recoveryTrustDriverTransitionBalanceEscapeDurabilityMagnitude = min(6, $recoveryTrustDriverTransitionBalanceEscapeDurabilityStreak * 3);
        if ($recoveryTrustDriverTransitionBalanceEscapeDurabilityDirection === 'positive') {
            $recoveryTrustDriverTransitionBalanceEscapeDurabilityAdjustment = $recoveryTrustDriverTransitionBalanceEscapeDurabilityMagnitude;
        } elseif ($recoveryTrustDriverTransitionBalanceEscapeDurabilityDirection === 'negative') {
            $recoveryTrustDriverTransitionBalanceEscapeDurabilityAdjustment = -$recoveryTrustDriverTransitionBalanceEscapeDurabilityMagnitude;
        }
    }
    $recoveryTrustDriverTransitionBalanceRecaptureAdjustment = 0;
    if ($recoveryTrustDriverTransitionBalanceRecapturedEntrenchment) {
        if ($recoveryTrustDriverTransitionBalanceRecaptureDirection === 'positive') {
            $recoveryTrustDriverTransitionBalanceRecaptureAdjustment = 4;
        } elseif ($recoveryTrustDriverTransitionBalanceRecaptureDirection === 'negative') {
            $recoveryTrustDriverTransitionBalanceRecaptureAdjustment = -8;
        }
    }
    $recoveryTrustDriverTransitionBalanceRecaptureStreakAdjustment = $recoveryTrustDriverTransitionBalanceRecaptureStreak > 0 ? -min(9, $recoveryTrustDriverTransitionBalanceRecaptureStreak * 3) : 0;
    $recoveryTrustDriverTransitionBalanceStructuralAdjustment = 0;
    if ($recoveryTrustDriverTransitionBalanceStructuralState === 'terminal') $recoveryTrustDriverTransitionBalanceStructuralAdjustment = -12;
    elseif ($recoveryTrustDriverTransitionBalanceStructuralState === 'compromised') $recoveryTrustDriverTransitionBalanceStructuralAdjustment = -6;
    elseif ($recoveryTrustDriverTransitionBalanceStructuralState === 'weakening') $recoveryTrustDriverTransitionBalanceStructuralAdjustment = -3;
    elseif ($recoveryTrustDriverTransitionBalanceStructuralState === 'sound') $recoveryTrustDriverTransitionBalanceStructuralAdjustment = 4;
    elseif ($recoveryTrustDriverTransitionBalanceStructuralState === 'fortified') $recoveryTrustDriverTransitionBalanceStructuralAdjustment = 8;
    $priorityScore = round($priorityScore + $convergenceBoost + $dependencyPenalty + $dependencyRecoveryBoost + $dependencyRecoveryDurabilityBoost + $durableRecoveryRelapsePenalty + $relapseResilienceAdjustment + $recoveryMaturityAdjustment + $recoveryMaturityDriftAdjustment + $recoveryMaturityReversalAdjustment + $recoveryMaturityReversalStreakAdjustment + $recoveryMaturityStabilityBoost + $recoveryMaturityBreakdownRiskAdjustment + $recoveryTrustHealthAdjustment + $recoveryTrustHealthTrendAdjustment + $recoveryTrustHealthReversalAdjustment + $recoveryTrustHealthReversalStreakAdjustment + $recoveryTrustDriverShiftAdjustment + $recoveryTrustDriverShiftStreakAdjustment + $recoveryTrustDriverTransitionAdjustment + $recoveryTrustDriverNegativeTransitionStreakAdjustment + $recoveryTrustDriverPositiveTransitionStreakBoost + $recoveryTrustDriverTransitionBalanceAdjustment + $recoveryTrustDriverTransitionBalanceReversalAdjustment + $recoveryTrustDriverTransitionBalanceReversalStreakAdjustment + $recoveryTrustDriverTransitionBalanceStabilityAdjustment + $recoveryTrustDriverTransitionBalanceEntrenchmentAdjustment + $recoveryTrustDriverTransitionBalanceEntrenchmentEscapeAdjustment + $recoveryTrustDriverTransitionBalanceEscapeDurabilityAdjustment + $recoveryTrustDriverTransitionBalanceRecaptureAdjustment + $recoveryTrustDriverTransitionBalanceRecaptureStreakAdjustment + $recoveryTrustDriverTransitionBalanceStructuralAdjustment, 2);
    $confidenceReasons = [];
    if ($suppressed) $confidenceReasons[] = 'suppressed by repeated negative outcomes';
    elseif ($outcomeScore > 0) $confidenceReasons[] = 'positive outcome history';
    elseif ($outcomeScore < 0) $confidenceReasons[] = 'negative outcome drag';
    if ($playbookBoost > 0) $confidenceReasons[] = 'playbook ' . $playbookConfidence . ' boost';
    if ($revivalBoost > 0) $confidenceReasons[] = 'revival momentum';
    elseif ($revivalBoost < 0) $confidenceReasons[] = 'failed revival penalty';
    if ($stableBoost > 0) $confidenceReasons[] = $stabilityState . ' stability boost';
    if ($churnPenalty < 0) $confidenceReasons[] = 'churn penalty';
    if ($volatilityBoost > 0) $confidenceReasons[] = 'low-volatility trust boost';
    if ($volatilityPenalty < 0) $confidenceReasons[] = 'confidence volatility penalty';
    if ($upgradeConfirmationBoost > 0) $confidenceReasons[] = 'repeated confidence-upgrade boost';
    if ($upgradeDowngradePenalty < 0) $confidenceReasons[] = 'frequent downgrade penalty';
    if ($trustMomentumAdjustment > 0) $confidenceReasons[] = 'positive trust momentum';
    if ($trustMomentumAdjustment < 0) $confidenceReasons[] = 'negative trust momentum';
    if ($trustMomentumReversalAdjustment > 0) $confidenceReasons[] = 'positive momentum reversal';
    if ($trustMomentumReversalAdjustment < 0) $confidenceReasons[] = 'negative momentum reversal';
    if ($trustMomentumReversalStreakAdjustment < 0) $confidenceReasons[] = 'momentum whipsaw penalty';
    if ($trustMomentumStabilityBoost > 0) $confidenceReasons[] = 'momentum stabilization boost';
    if ($convergenceBoost > 0) $confidenceReasons[] = 'confidence convergence boost';
    if ($dependencyPenalty < 0) $confidenceReasons[] = 'confidence convergence failure';
    if ($dependencyRecoveryBoost > 0) $confidenceReasons[] = 'dependency recovery boost';
    if ($dependencyRecoveryDurabilityBoost > 0) $confidenceReasons[] = 'durable recovery boost';
    if ($durableRecoveryRelapsePenalty < 0) $confidenceReasons[] = 'durable recovery relapse';
    if ($relapseResilienceAdjustment > 0) $confidenceReasons[] = 'relapse resilience boost';
    if ($relapseResilienceAdjustment < 0) $confidenceReasons[] = 'relapse fragility penalty';
    if ($recoveryMaturityAdjustment > 0) $confidenceReasons[] = 'recovery maturity boost';
    if ($recoveryMaturityDriftAdjustment > 0) $confidenceReasons[] = 'recovery maturity rising';
    if ($recoveryMaturityDriftAdjustment < 0) $confidenceReasons[] = 'recovery maturity falling';
    if ($recoveryMaturityReversalAdjustment < 0) $confidenceReasons[] = 'recovery maturity reversal';
    if ($recoveryMaturityReversalStreakAdjustment < 0) $confidenceReasons[] = 'recovery maturity whipsaw';
    if ($recoveryMaturityStabilityBoost > 0) $confidenceReasons[] = 'recovery maturity stability';
    if ($recoveryMaturityBreakdownRiskAdjustment < 0) $confidenceReasons[] = 'recovery maturity breakdown risk';
    if ($recoveryTrustHealthAdjustment > 0) $confidenceReasons[] = 'recovery-trust health boost';
    if ($recoveryTrustHealthAdjustment < 0) $confidenceReasons[] = 'recovery-trust fragility penalty';
    if ($recoveryTrustHealthTrendAdjustment > 0) $confidenceReasons[] = 'recovery-trust health improving';
    if ($recoveryTrustHealthTrendAdjustment < 0) $confidenceReasons[] = 'recovery-trust health decaying';
    if ($recoveryTrustHealthReversalAdjustment < 0) $confidenceReasons[] = 'recovery-trust health reversal';
    if ($recoveryTrustHealthReversalStreakAdjustment < 0) $confidenceReasons[] = 'recovery-trust health whipsaw';
    if ($recoveryTrustDriverShiftAdjustment < 0) $confidenceReasons[] = 'recovery-trust driver shift';
    if ($recoveryTrustDriverShiftStreakAdjustment < 0) $confidenceReasons[] = 'recovery-trust driver churn';
    if ($recoveryTrustDriverTransitionAdjustment > 0) $confidenceReasons[] = 'positive recovery-driver transition';
    if ($recoveryTrustDriverTransitionAdjustment < 0) $confidenceReasons[] = 'negative recovery-driver transition';
    if ($recoveryTrustDriverNegativeTransitionStreakAdjustment < 0) $confidenceReasons[] = 'repeated negative recovery-driver transitions';
    if ($recoveryTrustDriverPositiveTransitionStreakBoost > 0) $confidenceReasons[] = 'repeated positive recovery-driver transitions';
    if ($recoveryTrustDriverTransitionBalanceAdjustment > 0) $confidenceReasons[] = 'recovery-driver transition balance improving';
    if ($recoveryTrustDriverTransitionBalanceAdjustment < 0) $confidenceReasons[] = 'recovery-driver transition balance deteriorating';
    if ($recoveryTrustDriverTransitionBalanceReversalAdjustment > 0) $confidenceReasons[] = 'recovery-driver transition balance reversed positively';
    if ($recoveryTrustDriverTransitionBalanceReversalAdjustment < 0) $confidenceReasons[] = 'recovery-driver transition balance reversed negatively';
    if ($recoveryTrustDriverTransitionBalanceReversalStreakAdjustment < 0) $confidenceReasons[] = 'repeated recovery-driver balance reversals';
    if ($recoveryTrustDriverTransitionBalanceStabilityAdjustment > 0) $confidenceReasons[] = 'recovery-driver transition balance stabilized positively';
    if ($recoveryTrustDriverTransitionBalanceStabilityAdjustment < 0) $confidenceReasons[] = 'recovery-driver transition balance stabilized negatively';
    if ($recoveryTrustDriverTransitionBalanceEntrenchmentAdjustment > 0) $confidenceReasons[] = 'recovery-driver transition balance entrenched positively';
    if ($recoveryTrustDriverTransitionBalanceEntrenchmentAdjustment < 0) $confidenceReasons[] = 'recovery-driver transition balance entrenched negatively';
    if ($recoveryTrustDriverTransitionBalanceEntrenchmentEscapeAdjustment > 0) $confidenceReasons[] = 'escaped deterioration entrenchment';
    if ($recoveryTrustDriverTransitionBalanceEntrenchmentEscapeAdjustment < 0) $confidenceReasons[] = 'lost recovery entrenchment';
    if ($recoveryTrustDriverTransitionBalanceEscapeDurabilityAdjustment > 0) $confidenceReasons[] = 'durable deterioration escape';
    if ($recoveryTrustDriverTransitionBalanceEscapeDurabilityAdjustment < 0) $confidenceReasons[] = 'durable loss of recovery entrenchment';
    if ($recoveryTrustDriverTransitionBalanceRecaptureAdjustment > 0) $confidenceReasons[] = 'recovered recovery entrenchment';
    if ($recoveryTrustDriverTransitionBalanceRecaptureAdjustment < 0) $confidenceReasons[] = 'failed deterioration escape';
    if ($recoveryTrustDriverTransitionBalanceRecaptureStreakAdjustment < 0) $confidenceReasons[] = 'repeated breakout failures';
    if ($recoveryTrustDriverTransitionBalanceStructuralAdjustment > 0) $confidenceReasons[] = "structural state: {$recoveryTrustDriverTransitionBalanceStructuralState}";
    if ($recoveryTrustDriverTransitionBalanceStructuralAdjustment < 0) $confidenceReasons[] = "structural state: {$recoveryTrustDriverTransitionBalanceStructuralState}";
    if ($confidenceBand !== $baseConfidenceBand) {
        $confidenceReasons[] = $resilienceBand === 'durable' ? 'resilience raised confidence' : 'resilience lowered confidence';
    }
    if (($confidenceHistory['trend'] ?? '') === 'rising') $confidenceReasons[] = 'confidence rising recently';
    elseif (($confidenceHistory['trend'] ?? '') === 'falling') $confidenceReasons[] = 'confidence falling recently';
    elseif (($confidenceHistory['trend'] ?? '') === 'steady' && isset($confidenceHistory['delta'])) $confidenceReasons[] = 'confidence holding steady';
    if (!$confidenceReasons) $confidenceReasons[] = 'limited evidence so far';
    $confidenceReason = implode(', ', array_slice($confidenceReasons, 0, 3));
    return array_merge($item, [
        'acceptedCount' => $acceptedCount,
        'surfacedCount' => $surfacedCount,
        'acceptanceRate' => $acceptanceRate,
        'positiveCount' => $positiveCount,
        'negativeCount' => $negativeCount,
        'outcomeScore' => $outcomeScore,
        'freshness' => $freshness,
        'decayMultiplier' => $decayMultiplier,
        'rawPlaybookScore' => $rawPlaybookScore,
        'playbookScore' => $playbookScore,
        'playbookConfidence' => $playbookConfidence,
        'playbookBoost' => $playbookBoost,
        'revivalStatus' => $revivalStatus,
        'revivalBoost' => $revivalBoost,
        'changeCount' => $changeCount,
        'lastChangedAt' => $lastChangedAt,
        'stabilityAgeHours' => $stabilityAgeHours,
        'stabilityState' => $stabilityState,
        'stableBoost' => $stableBoost,
        'churnPenalty' => $churnPenalty,
        'volatilityState' => $volatilityState,
        'trendShiftCount' => $trendShiftCount,
        'volatilityBoost' => $volatilityBoost,
        'volatilityPenalty' => $volatilityPenalty,
        'upgradedCount' => $upgradedCount,
        'downgradedCount' => $downgradedCount,
        'upgradeConfirmationBoost' => $upgradeConfirmationBoost,
        'upgradeDowngradePenalty' => $upgradeDowngradePenalty,
        'trustMomentumScore' => $trustMomentumScore,
        'trustMomentumBand' => $trustMomentumBand,
        'trustMomentumAdjustment' => $trustMomentumAdjustment,
        'trustMomentumReversalCount' => $trustMomentumReversalCount,
        'trustMomentumReversalStreak' => $trustMomentumReversalStreak,
        'trustMomentumStabilityStreak' => $trustMomentumStabilityStreak,
        'trustMomentumJustReversed' => $trustMomentumJustReversed,
        'trustMomentumReversalAdjustment' => $trustMomentumReversalAdjustment,
        'trustMomentumReversalStreakAdjustment' => $trustMomentumReversalStreakAdjustment,
        'trustMomentumStabilityBoost' => $trustMomentumStabilityBoost,
        'convergenceCount' => $convergenceCount,
        'convergenceStreak' => $convergenceStreak,
        'justConverged' => $justConverged,
        'convergenceBoost' => $convergenceBoost,
        'dependencyCount' => $dependencyCount,
        'dependencyStreak' => $dependencyStreak,
        'justBecameDependent' => $justBecameDependent,
        'dependencyPenalty' => $dependencyPenalty,
        'dependencyRecoveryCount' => $dependencyRecoveryCount,
        'dependencyRecoveryStreak' => $dependencyRecoveryStreak,
        'justRecoveredFromDependency' => $justRecoveredFromDependency,
        'dependencyRecoveryBoost' => $dependencyRecoveryBoost,
        'dependencyRecoveryDurability' => $dependencyRecoveryDurability,
        'durableRecoveryCount' => $durableRecoveryCount,
        'justBecameDurableRecovery' => $justBecameDurableRecovery,
        'dependencyRecoveryDurabilityBoost' => $dependencyRecoveryDurabilityBoost,
        'durableRecoveryRelapseCount' => $durableRecoveryRelapseCount,
        'justRelapsedFromDurableRecovery' => $justRelapsedFromDurableRecovery,
        'durableRecoveryRelapsePenalty' => $durableRecoveryRelapsePenalty,
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
        'recoveryTrustNetAdjustment' => $recoveryTrustNetAdjustment,
        'recoveryTrustAdjustmentCount' => $recoveryTrustAdjustmentCount,
        'recoveryTrustTopDriver' => $recoveryTrustTopDriver,
        'recoveryTrustTopDriverAdjustment' => $recoveryTrustTopDriverAdjustment,
        'recoveryTrustAdjustmentSummary' => $recoveryTrustAdjustmentSummary,
        'previousRecoveryTrustTopDriver' => $previousRecoveryTrustTopDriver,
        'recoveryTrustDriverShiftCount' => $recoveryTrustDriverShiftCount,
        'recoveryTrustDriverShiftStreak' => $recoveryTrustDriverShiftStreak,
        'recoveryTrustDriverJustShifted' => $recoveryTrustDriverJustShifted,
        'recoveryTrustDriverTransition' => $recoveryTrustDriverTransition,
        'recoveryTrustDriverTransitionSeverityScore' => $recoveryTrustDriverTransitionSeverityScore,
        'recoveryTrustDriverTransitionSeverityBand' => $recoveryTrustDriverTransitionSeverityBand,
        'recoveryTrustDriverNegativeTransitionCount' => $recoveryTrustDriverNegativeTransitionCount,
        'recoveryTrustDriverNegativeTransitionStreak' => $recoveryTrustDriverNegativeTransitionStreak,
        'recoveryTrustDriverPositiveTransitionCount' => $recoveryTrustDriverPositiveTransitionCount,
        'recoveryTrustDriverPositiveTransitionStreak' => $recoveryTrustDriverPositiveTransitionStreak,
        'previousRecoveryTrustDriverTransitionBalanceScore' => $previousRecoveryTrustDriverTransitionBalanceScore,
        'previousRecoveryTrustDriverTransitionBalanceBand' => $previousRecoveryTrustDriverTransitionBalanceBand,
        'recoveryTrustDriverTransitionBalanceScore' => $recoveryTrustDriverTransitionBalanceScore,
        'recoveryTrustDriverTransitionBalanceBand' => $recoveryTrustDriverTransitionBalanceBand,
        'recoveryTrustDriverTransitionBalanceReversalCount' => $recoveryTrustDriverTransitionBalanceReversalCount,
        'recoveryTrustDriverTransitionBalanceJustReversed' => $recoveryTrustDriverTransitionBalanceJustReversed,
        'recoveryTrustDriverTransitionBalanceReversalStreak' => $recoveryTrustDriverTransitionBalanceReversalStreak,
        'recoveryTrustDriverTransitionBalanceStabilityStreak' => $recoveryTrustDriverTransitionBalanceStabilityStreak,
        'recoveryTrustDriverTransitionBalanceStabilityPolarity' => $recoveryTrustDriverTransitionBalanceStabilityPolarity,
        'previousRecoveryTrustDriverTransitionBalanceEntrenchmentBand' => $previousRecoveryTrustDriverTransitionBalanceEntrenchmentBand,
        'recoveryTrustDriverTransitionBalanceEntrenchmentBand' => $recoveryTrustDriverTransitionBalanceEntrenchmentBand,
        'recoveryTrustDriverTransitionBalanceEntrenchmentCount' => $recoveryTrustDriverTransitionBalanceEntrenchmentCount,
        'recoveryTrustDriverTransitionBalanceJustEntrenched' => $recoveryTrustDriverTransitionBalanceJustEntrenched,
        'recoveryTrustDriverTransitionBalanceEscapeCount' => $recoveryTrustDriverTransitionBalanceEscapeCount,
        'recoveryTrustDriverTransitionBalanceEscapedEntrenchment' => $recoveryTrustDriverTransitionBalanceEscapedEntrenchment,
        'recoveryTrustDriverTransitionBalanceEntrenchmentEscapeDirection' => $recoveryTrustDriverTransitionBalanceEntrenchmentEscapeDirection,
        'previousRecoveryTrustDriverTransitionBalanceEscapeDurabilityDirection' => $previousRecoveryTrustDriverTransitionBalanceEscapeDurabilityDirection,
        'recoveryTrustDriverTransitionBalanceEscapeDurabilityStreak' => $recoveryTrustDriverTransitionBalanceEscapeDurabilityStreak,
        'recoveryTrustDriverTransitionBalanceEscapeDurabilityDirection' => $recoveryTrustDriverTransitionBalanceEscapeDurabilityDirection,
        'recoveryTrustDriverTransitionBalanceEscapedEntrenchmentDurably' => $recoveryTrustDriverTransitionBalanceEscapedEntrenchmentDurably,
        'recoveryTrustDriverTransitionBalanceRecaptureCount' => $recoveryTrustDriverTransitionBalanceRecaptureCount,
        'recoveryTrustDriverTransitionBalanceRecapturedEntrenchment' => $recoveryTrustDriverTransitionBalanceRecapturedEntrenchment,
        'recoveryTrustDriverTransitionBalanceRecaptureDirection' => $recoveryTrustDriverTransitionBalanceRecaptureDirection,
        'recoveryTrustDriverTransitionBalanceRecaptureStreak' => $recoveryTrustDriverTransitionBalanceRecaptureStreak,
        'recoveryTrustDriverTransitionBalanceStructuralState' => $recoveryTrustDriverTransitionBalanceStructuralState,
        'recoveryTrustDriverShiftAdjustment' => $recoveryTrustDriverShiftAdjustment,
        'recoveryTrustDriverShiftStreakAdjustment' => $recoveryTrustDriverShiftStreakAdjustment,
        'recoveryTrustDriverTransitionAdjustment' => $recoveryTrustDriverTransitionAdjustment,
        'recoveryTrustDriverNegativeTransitionStreakAdjustment' => $recoveryTrustDriverNegativeTransitionStreakAdjustment,
        'recoveryTrustDriverPositiveTransitionStreakBoost' => $recoveryTrustDriverPositiveTransitionStreakBoost,
        'recoveryTrustDriverTransitionBalanceAdjustment' => $recoveryTrustDriverTransitionBalanceAdjustment,
        'recoveryTrustDriverTransitionBalanceReversalAdjustment' => $recoveryTrustDriverTransitionBalanceReversalAdjustment,
        'recoveryTrustDriverTransitionBalanceReversalStreakAdjustment' => $recoveryTrustDriverTransitionBalanceReversalStreakAdjustment,
        'recoveryTrustDriverTransitionBalanceStabilityAdjustment' => $recoveryTrustDriverTransitionBalanceStabilityAdjustment,
        'recoveryTrustDriverTransitionBalanceEntrenchmentAdjustment' => $recoveryTrustDriverTransitionBalanceEntrenchmentAdjustment,
        'recoveryTrustDriverTransitionBalanceEntrenchmentEscapeAdjustment' => $recoveryTrustDriverTransitionBalanceEntrenchmentEscapeAdjustment,
        'recoveryTrustDriverTransitionBalanceEscapeDurabilityAdjustment' => $recoveryTrustDriverTransitionBalanceEscapeDurabilityAdjustment,
        'recoveryTrustDriverTransitionBalanceRecaptureAdjustment' => $recoveryTrustDriverTransitionBalanceRecaptureAdjustment,
        'recoveryTrustDriverTransitionBalanceRecaptureStreakAdjustment' => $recoveryTrustDriverTransitionBalanceRecaptureStreakAdjustment,
        'recoveryTrustDriverTransitionBalanceStructuralAdjustment' => $recoveryTrustDriverTransitionBalanceStructuralAdjustment,
        'baseConfidenceBand' => $baseConfidenceBand,
        'confidenceBand' => $confidenceBand,
        'confidenceReason' => $confidenceReason,
        'confidenceTrend' => $confidenceHistory['trend'] ?? 'steady',
        'confidenceDelta' => $confidenceHistory['delta'] ?? 0,
        'resilienceScore' => $resilienceScore,
        'resilienceBand' => $resilienceBand,
        'priorityScore' => $priorityScore,
        'promotion' => $promotion,
        'suppressed' => $suppressed,
        'revived' => $revived
    ]);
}, $items);
usort($prioritized, function ($a, $b) use ($priorityRank) {
    return $priorityRank[$b['promotion'] ?? 'suppressed'] <=> $priorityRank[$a['promotion'] ?? 'suppressed']
        ?: (($b['priorityScore'] ?? 0) <=> ($a['priorityScore'] ?? 0));
});

$visible = array_values(array_filter($prioritized, function ($item) {
    return !($item['suppressed'] ?? false);
}));

$suppressedItems = array_values(array_filter($prioritized, function ($item) {
    return (bool) ($item['suppressed'] ?? false);
}));

$revivedItems = array_values(array_filter($prioritized, function ($item) {
    return (bool) ($item['revived'] ?? false);
}));

$stableItems = array_values(array_filter($prioritized, function ($item) {
    return intval($item['stableBoost'] ?? 0) > 0;
}));

echo json_encode([
    'items' => $prioritized,
    'visibleItems' => $visible,
    'suppressedItems' => $suppressedItems,
    'revivedItems' => $revivedItems,
    'stableItems' => $stableItems,
    'topAction' => $visible[0]['action'] ?? $prioritized[0]['action'] ?? null,
    'topPromotion' => $visible[0]['promotion'] ?? $prioritized[0]['promotion'] ?? null,
    'topPriorityScore' => $visible[0]['priorityScore'] ?? $prioritized[0]['priorityScore'] ?? 0,
    'topOutcomeScore' => $visible[0]['outcomeScore'] ?? $prioritized[0]['outcomeScore'] ?? 0,
    'topPlaybookConfidence' => $visible[0]['playbookConfidence'] ?? $prioritized[0]['playbookConfidence'] ?? 'none',
    'topPlaybookBoost' => $visible[0]['playbookBoost'] ?? $prioritized[0]['playbookBoost'] ?? 0,
    'topRevivalStatus' => $visible[0]['revivalStatus'] ?? $prioritized[0]['revivalStatus'] ?? null,
    'topRevivalBoost' => $visible[0]['revivalBoost'] ?? $prioritized[0]['revivalBoost'] ?? 0,
    'topChangeCount' => $visible[0]['changeCount'] ?? $prioritized[0]['changeCount'] ?? 0,
    'topChurnPenalty' => $visible[0]['churnPenalty'] ?? $prioritized[0]['churnPenalty'] ?? 0,
    'topStabilityState' => $visible[0]['stabilityState'] ?? $prioritized[0]['stabilityState'] ?? 'new',
    'topStableBoost' => $visible[0]['stableBoost'] ?? $prioritized[0]['stableBoost'] ?? 0,
    'topConfidenceBand' => $visible[0]['confidenceBand'] ?? $prioritized[0]['confidenceBand'] ?? 'low',
    'topConfidenceReason' => $visible[0]['confidenceReason'] ?? $prioritized[0]['confidenceReason'] ?? null,
    'topConfidenceTrend' => $visible[0]['confidenceTrend'] ?? $prioritized[0]['confidenceTrend'] ?? 'steady',
    'topConfidenceDelta' => $visible[0]['confidenceDelta'] ?? $prioritized[0]['confidenceDelta'] ?? 0,
    'topResilienceScore' => $visible[0]['resilienceScore'] ?? $prioritized[0]['resilienceScore'] ?? 0,
    'topResilienceBand' => $visible[0]['resilienceBand'] ?? $prioritized[0]['resilienceBand'] ?? 'fragile',
    'topVolatilityState' => $visible[0]['volatilityState'] ?? $prioritized[0]['volatilityState'] ?? 'low',
    'topVolatilityPenalty' => $visible[0]['volatilityPenalty'] ?? $prioritized[0]['volatilityPenalty'] ?? 0,
    'topVolatilityBoost' => $visible[0]['volatilityBoost'] ?? $prioritized[0]['volatilityBoost'] ?? 0,
    'topUpgradedCount' => $visible[0]['upgradedCount'] ?? $prioritized[0]['upgradedCount'] ?? 0,
    'topUpgradeConfirmationBoost' => $visible[0]['upgradeConfirmationBoost'] ?? $prioritized[0]['upgradeConfirmationBoost'] ?? 0,
    'topDowngradedCount' => $visible[0]['downgradedCount'] ?? $prioritized[0]['downgradedCount'] ?? 0,
    'topUpgradeDowngradePenalty' => $visible[0]['upgradeDowngradePenalty'] ?? $prioritized[0]['upgradeDowngradePenalty'] ?? 0,
    'topTrustMomentumScore' => $visible[0]['trustMomentumScore'] ?? $prioritized[0]['trustMomentumScore'] ?? 0,
    'topTrustMomentumBand' => $visible[0]['trustMomentumBand'] ?? $prioritized[0]['trustMomentumBand'] ?? 'neutral',
    'topTrustMomentumAdjustment' => $visible[0]['trustMomentumAdjustment'] ?? $prioritized[0]['trustMomentumAdjustment'] ?? 0,
    'topTrustMomentumReversalCount' => $visible[0]['trustMomentumReversalCount'] ?? $prioritized[0]['trustMomentumReversalCount'] ?? 0,
    'topTrustMomentumReversalStreak' => $visible[0]['trustMomentumReversalStreak'] ?? $prioritized[0]['trustMomentumReversalStreak'] ?? 0,
    'topTrustMomentumStabilityStreak' => $visible[0]['trustMomentumStabilityStreak'] ?? $prioritized[0]['trustMomentumStabilityStreak'] ?? 0,
    'topTrustMomentumJustReversed' => $visible[0]['trustMomentumJustReversed'] ?? $prioritized[0]['trustMomentumJustReversed'] ?? false,
    'topTrustMomentumReversalAdjustment' => $visible[0]['trustMomentumReversalAdjustment'] ?? $prioritized[0]['trustMomentumReversalAdjustment'] ?? 0,
    'topTrustMomentumReversalStreakAdjustment' => $visible[0]['trustMomentumReversalStreakAdjustment'] ?? $prioritized[0]['trustMomentumReversalStreakAdjustment'] ?? 0,
    'topTrustMomentumStabilityBoost' => $visible[0]['trustMomentumStabilityBoost'] ?? $prioritized[0]['trustMomentumStabilityBoost'] ?? 0,
    'topConvergenceCount' => $visible[0]['convergenceCount'] ?? $prioritized[0]['convergenceCount'] ?? 0,
    'topConvergenceStreak' => $visible[0]['convergenceStreak'] ?? $prioritized[0]['convergenceStreak'] ?? 0,
    'topJustConverged' => $visible[0]['justConverged'] ?? $prioritized[0]['justConverged'] ?? false,
    'topConvergenceBoost' => $visible[0]['convergenceBoost'] ?? $prioritized[0]['convergenceBoost'] ?? 0,
    'topDependencyCount' => $visible[0]['dependencyCount'] ?? $prioritized[0]['dependencyCount'] ?? 0,
    'topDependencyStreak' => $visible[0]['dependencyStreak'] ?? $prioritized[0]['dependencyStreak'] ?? 0,
    'topJustBecameDependent' => $visible[0]['justBecameDependent'] ?? $prioritized[0]['justBecameDependent'] ?? false,
    'topDependencyPenalty' => $visible[0]['dependencyPenalty'] ?? $prioritized[0]['dependencyPenalty'] ?? 0,
    'topDependencyRecoveryCount' => $visible[0]['dependencyRecoveryCount'] ?? $prioritized[0]['dependencyRecoveryCount'] ?? 0,
    'topDependencyRecoveryStreak' => $visible[0]['dependencyRecoveryStreak'] ?? $prioritized[0]['dependencyRecoveryStreak'] ?? 0,
    'topJustRecoveredFromDependency' => $visible[0]['justRecoveredFromDependency'] ?? $prioritized[0]['justRecoveredFromDependency'] ?? false,
    'topDependencyRecoveryBoost' => $visible[0]['dependencyRecoveryBoost'] ?? $prioritized[0]['dependencyRecoveryBoost'] ?? 0,
    'topDependencyRecoveryDurability' => $visible[0]['dependencyRecoveryDurability'] ?? $prioritized[0]['dependencyRecoveryDurability'] ?? 'fragile',
    'topDurableRecoveryCount' => $visible[0]['durableRecoveryCount'] ?? $prioritized[0]['durableRecoveryCount'] ?? 0,
    'topJustBecameDurableRecovery' => $visible[0]['justBecameDurableRecovery'] ?? $prioritized[0]['justBecameDurableRecovery'] ?? false,
    'topDependencyRecoveryDurabilityBoost' => $visible[0]['dependencyRecoveryDurabilityBoost'] ?? $prioritized[0]['dependencyRecoveryDurabilityBoost'] ?? 0,
    'topDurableRecoveryRelapseCount' => $visible[0]['durableRecoveryRelapseCount'] ?? $prioritized[0]['durableRecoveryRelapseCount'] ?? 0,
    'topJustRelapsedFromDurableRecovery' => $visible[0]['justRelapsedFromDurableRecovery'] ?? $prioritized[0]['justRelapsedFromDurableRecovery'] ?? false,
    'topDurableRecoveryRelapsePenalty' => $visible[0]['durableRecoveryRelapsePenalty'] ?? $prioritized[0]['durableRecoveryRelapsePenalty'] ?? 0,
    'topRelapseResilienceScore' => $visible[0]['relapseResilienceScore'] ?? $prioritized[0]['relapseResilienceScore'] ?? 0,
    'topRelapseResilienceBand' => $visible[0]['relapseResilienceBand'] ?? $prioritized[0]['relapseResilienceBand'] ?? 'neutral',
    'topRelapseResilienceAdjustment' => $visible[0]['relapseResilienceAdjustment'] ?? $prioritized[0]['relapseResilienceAdjustment'] ?? 0,
    'topRecoveryMaturityScore' => $visible[0]['recoveryMaturityScore'] ?? $prioritized[0]['recoveryMaturityScore'] ?? 0,
    'topRecoveryMaturityBand' => $visible[0]['recoveryMaturityBand'] ?? $prioritized[0]['recoveryMaturityBand'] ?? 'early',
    'topRecoveryMaturityAdjustment' => $visible[0]['recoveryMaturityAdjustment'] ?? $prioritized[0]['recoveryMaturityAdjustment'] ?? 0,
    'topRecoveryMaturityDelta' => $visible[0]['recoveryMaturityDelta'] ?? $prioritized[0]['recoveryMaturityDelta'] ?? 0,
    'topRecoveryMaturityDrift' => $visible[0]['recoveryMaturityDrift'] ?? $prioritized[0]['recoveryMaturityDrift'] ?? 'steady',
    'topRecoveryMaturityDriftAdjustment' => $visible[0]['recoveryMaturityDriftAdjustment'] ?? $prioritized[0]['recoveryMaturityDriftAdjustment'] ?? 0,
    'topRecoveryMaturityReversalCount' => $visible[0]['recoveryMaturityReversalCount'] ?? $prioritized[0]['recoveryMaturityReversalCount'] ?? 0,
    'topRecoveryMaturityReversalStreak' => $visible[0]['recoveryMaturityReversalStreak'] ?? $prioritized[0]['recoveryMaturityReversalStreak'] ?? 0,
    'topRecoveryMaturityStabilityStreak' => $visible[0]['recoveryMaturityStabilityStreak'] ?? $prioritized[0]['recoveryMaturityStabilityStreak'] ?? 0,
    'topRecoveryMaturityJustReversed' => $visible[0]['recoveryMaturityJustReversed'] ?? $prioritized[0]['recoveryMaturityJustReversed'] ?? false,
    'topRecoveryMaturityReversalAdjustment' => $visible[0]['recoveryMaturityReversalAdjustment'] ?? $prioritized[0]['recoveryMaturityReversalAdjustment'] ?? 0,
    'topRecoveryMaturityReversalStreakAdjustment' => $visible[0]['recoveryMaturityReversalStreakAdjustment'] ?? $prioritized[0]['recoveryMaturityReversalStreakAdjustment'] ?? 0,
    'topRecoveryMaturityStabilityBoost' => $visible[0]['recoveryMaturityStabilityBoost'] ?? $prioritized[0]['recoveryMaturityStabilityBoost'] ?? 0,
    'topRecoveryMaturityBreakdownRiskScore' => $visible[0]['recoveryMaturityBreakdownRiskScore'] ?? $prioritized[0]['recoveryMaturityBreakdownRiskScore'] ?? 0,
    'topRecoveryMaturityBreakdownRiskBand' => $visible[0]['recoveryMaturityBreakdownRiskBand'] ?? $prioritized[0]['recoveryMaturityBreakdownRiskBand'] ?? 'low',
    'topRecoveryMaturityBreakdownRiskAdjustment' => $visible[0]['recoveryMaturityBreakdownRiskAdjustment'] ?? $prioritized[0]['recoveryMaturityBreakdownRiskAdjustment'] ?? 0,
    'topRecoveryTrustHealthScore' => $visible[0]['recoveryTrustHealthScore'] ?? $prioritized[0]['recoveryTrustHealthScore'] ?? 0,
    'topRecoveryTrustHealthBand' => $visible[0]['recoveryTrustHealthBand'] ?? $prioritized[0]['recoveryTrustHealthBand'] ?? 'fragile',
    'topRecoveryTrustHealthAdjustment' => $visible[0]['recoveryTrustHealthAdjustment'] ?? $prioritized[0]['recoveryTrustHealthAdjustment'] ?? 0,
    'topRecoveryTrustHealthDelta' => $visible[0]['recoveryTrustHealthDelta'] ?? $prioritized[0]['recoveryTrustHealthDelta'] ?? 0,
    'topRecoveryTrustHealthTrend' => $visible[0]['recoveryTrustHealthTrend'] ?? $prioritized[0]['recoveryTrustHealthTrend'] ?? 'steady',
    'topRecoveryTrustHealthTrendAdjustment' => $visible[0]['recoveryTrustHealthTrendAdjustment'] ?? $prioritized[0]['recoveryTrustHealthTrendAdjustment'] ?? 0,
    'topRecoveryTrustHealthReversalCount' => $visible[0]['recoveryTrustHealthReversalCount'] ?? $prioritized[0]['recoveryTrustHealthReversalCount'] ?? 0,
    'topRecoveryTrustHealthReversalStreak' => $visible[0]['recoveryTrustHealthReversalStreak'] ?? $prioritized[0]['recoveryTrustHealthReversalStreak'] ?? 0,
    'topRecoveryTrustHealthJustReversed' => $visible[0]['recoveryTrustHealthJustReversed'] ?? $prioritized[0]['recoveryTrustHealthJustReversed'] ?? false,
    'topRecoveryTrustHealthReversalAdjustment' => $visible[0]['recoveryTrustHealthReversalAdjustment'] ?? $prioritized[0]['recoveryTrustHealthReversalAdjustment'] ?? 0,
    'topRecoveryTrustHealthReversalStreakAdjustment' => $visible[0]['recoveryTrustHealthReversalStreakAdjustment'] ?? $prioritized[0]['recoveryTrustHealthReversalStreakAdjustment'] ?? 0,
    'topRecoveryTrustNetAdjustment' => $visible[0]['recoveryTrustNetAdjustment'] ?? $prioritized[0]['recoveryTrustNetAdjustment'] ?? 0,
    'topRecoveryTrustAdjustmentCount' => $visible[0]['recoveryTrustAdjustmentCount'] ?? $prioritized[0]['recoveryTrustAdjustmentCount'] ?? 0,
    'topRecoveryTrustTopDriver' => $visible[0]['recoveryTrustTopDriver'] ?? $prioritized[0]['recoveryTrustTopDriver'] ?? null,
    'topRecoveryTrustTopDriverAdjustment' => $visible[0]['recoveryTrustTopDriverAdjustment'] ?? $prioritized[0]['recoveryTrustTopDriverAdjustment'] ?? 0,
    'topRecoveryTrustAdjustmentSummary' => $visible[0]['recoveryTrustAdjustmentSummary'] ?? $prioritized[0]['recoveryTrustAdjustmentSummary'] ?? '',
    'topPreviousRecoveryTrustTopDriver' => $visible[0]['previousRecoveryTrustTopDriver'] ?? $prioritized[0]['previousRecoveryTrustTopDriver'] ?? null,
    'topRecoveryTrustDriverShiftCount' => $visible[0]['recoveryTrustDriverShiftCount'] ?? $prioritized[0]['recoveryTrustDriverShiftCount'] ?? 0,
    'topRecoveryTrustDriverShiftStreak' => $visible[0]['recoveryTrustDriverShiftStreak'] ?? $prioritized[0]['recoveryTrustDriverShiftStreak'] ?? 0,
    'topRecoveryTrustDriverJustShifted' => $visible[0]['recoveryTrustDriverJustShifted'] ?? $prioritized[0]['recoveryTrustDriverJustShifted'] ?? false,
    'topRecoveryTrustDriverTransition' => $visible[0]['recoveryTrustDriverTransition'] ?? $prioritized[0]['recoveryTrustDriverTransition'] ?? '',
    'topRecoveryTrustDriverTransitionSeverityScore' => $visible[0]['recoveryTrustDriverTransitionSeverityScore'] ?? $prioritized[0]['recoveryTrustDriverTransitionSeverityScore'] ?? 0,
    'topRecoveryTrustDriverTransitionSeverityBand' => $visible[0]['recoveryTrustDriverTransitionSeverityBand'] ?? $prioritized[0]['recoveryTrustDriverTransitionSeverityBand'] ?? 'neutral',
    'topRecoveryTrustDriverNegativeTransitionCount' => $visible[0]['recoveryTrustDriverNegativeTransitionCount'] ?? $prioritized[0]['recoveryTrustDriverNegativeTransitionCount'] ?? 0,
    'topRecoveryTrustDriverNegativeTransitionStreak' => $visible[0]['recoveryTrustDriverNegativeTransitionStreak'] ?? $prioritized[0]['recoveryTrustDriverNegativeTransitionStreak'] ?? 0,
    'topRecoveryTrustDriverPositiveTransitionCount' => $visible[0]['recoveryTrustDriverPositiveTransitionCount'] ?? $prioritized[0]['recoveryTrustDriverPositiveTransitionCount'] ?? 0,
    'topRecoveryTrustDriverPositiveTransitionStreak' => $visible[0]['recoveryTrustDriverPositiveTransitionStreak'] ?? $prioritized[0]['recoveryTrustDriverPositiveTransitionStreak'] ?? 0,
    'topPreviousRecoveryTrustDriverTransitionBalanceScore' => $visible[0]['previousRecoveryTrustDriverTransitionBalanceScore'] ?? $prioritized[0]['previousRecoveryTrustDriverTransitionBalanceScore'] ?? 0,
    'topPreviousRecoveryTrustDriverTransitionBalanceBand' => $visible[0]['previousRecoveryTrustDriverTransitionBalanceBand'] ?? $prioritized[0]['previousRecoveryTrustDriverTransitionBalanceBand'] ?? 'balanced',
    'topRecoveryTrustDriverTransitionBalanceScore' => $visible[0]['recoveryTrustDriverTransitionBalanceScore'] ?? $prioritized[0]['recoveryTrustDriverTransitionBalanceScore'] ?? 0,
    'topRecoveryTrustDriverTransitionBalanceBand' => $visible[0]['recoveryTrustDriverTransitionBalanceBand'] ?? $prioritized[0]['recoveryTrustDriverTransitionBalanceBand'] ?? 'balanced',
    'topRecoveryTrustDriverTransitionBalanceReversalCount' => $visible[0]['recoveryTrustDriverTransitionBalanceReversalCount'] ?? $prioritized[0]['recoveryTrustDriverTransitionBalanceReversalCount'] ?? 0,
    'topRecoveryTrustDriverTransitionBalanceJustReversed' => $visible[0]['recoveryTrustDriverTransitionBalanceJustReversed'] ?? $prioritized[0]['recoveryTrustDriverTransitionBalanceJustReversed'] ?? false,
    'topRecoveryTrustDriverTransitionBalanceReversalStreak' => $visible[0]['recoveryTrustDriverTransitionBalanceReversalStreak'] ?? $prioritized[0]['recoveryTrustDriverTransitionBalanceReversalStreak'] ?? 0,
    'topRecoveryTrustDriverTransitionBalanceStabilityStreak' => $visible[0]['recoveryTrustDriverTransitionBalanceStabilityStreak'] ?? $prioritized[0]['recoveryTrustDriverTransitionBalanceStabilityStreak'] ?? 0,
    'topRecoveryTrustDriverTransitionBalanceStabilityPolarity' => $visible[0]['recoveryTrustDriverTransitionBalanceStabilityPolarity'] ?? $prioritized[0]['recoveryTrustDriverTransitionBalanceStabilityPolarity'] ?? 'neutral',
    'topPreviousRecoveryTrustDriverTransitionBalanceEntrenchmentBand' => $visible[0]['previousRecoveryTrustDriverTransitionBalanceEntrenchmentBand'] ?? $prioritized[0]['previousRecoveryTrustDriverTransitionBalanceEntrenchmentBand'] ?? 'none',
    'topRecoveryTrustDriverTransitionBalanceEntrenchmentBand' => $visible[0]['recoveryTrustDriverTransitionBalanceEntrenchmentBand'] ?? $prioritized[0]['recoveryTrustDriverTransitionBalanceEntrenchmentBand'] ?? 'none',
    'topRecoveryTrustDriverTransitionBalanceEntrenchmentCount' => $visible[0]['recoveryTrustDriverTransitionBalanceEntrenchmentCount'] ?? $prioritized[0]['recoveryTrustDriverTransitionBalanceEntrenchmentCount'] ?? 0,
    'topRecoveryTrustDriverTransitionBalanceJustEntrenched' => $visible[0]['recoveryTrustDriverTransitionBalanceJustEntrenched'] ?? $prioritized[0]['recoveryTrustDriverTransitionBalanceJustEntrenched'] ?? false,
    'topRecoveryTrustDriverTransitionBalanceEscapeCount' => $visible[0]['recoveryTrustDriverTransitionBalanceEscapeCount'] ?? $prioritized[0]['recoveryTrustDriverTransitionBalanceEscapeCount'] ?? 0,
    'topRecoveryTrustDriverTransitionBalanceEscapedEntrenchment' => $visible[0]['recoveryTrustDriverTransitionBalanceEscapedEntrenchment'] ?? $prioritized[0]['recoveryTrustDriverTransitionBalanceEscapedEntrenchment'] ?? false,
    'topRecoveryTrustDriverTransitionBalanceEntrenchmentEscapeDirection' => $visible[0]['recoveryTrustDriverTransitionBalanceEntrenchmentEscapeDirection'] ?? $prioritized[0]['recoveryTrustDriverTransitionBalanceEntrenchmentEscapeDirection'] ?? 'none',
    'topPreviousRecoveryTrustDriverTransitionBalanceEscapeDurabilityDirection' => $visible[0]['previousRecoveryTrustDriverTransitionBalanceEscapeDurabilityDirection'] ?? $prioritized[0]['previousRecoveryTrustDriverTransitionBalanceEscapeDurabilityDirection'] ?? 'none',
    'topRecoveryTrustDriverTransitionBalanceEscapeDurabilityStreak' => $visible[0]['recoveryTrustDriverTransitionBalanceEscapeDurabilityStreak'] ?? $prioritized[0]['recoveryTrustDriverTransitionBalanceEscapeDurabilityStreak'] ?? 0,
    'topRecoveryTrustDriverTransitionBalanceEscapeDurabilityDirection' => $visible[0]['recoveryTrustDriverTransitionBalanceEscapeDurabilityDirection'] ?? $prioritized[0]['recoveryTrustDriverTransitionBalanceEscapeDurabilityDirection'] ?? 'none',
    'topRecoveryTrustDriverTransitionBalanceEscapedEntrenchmentDurably' => $visible[0]['recoveryTrustDriverTransitionBalanceEscapedEntrenchmentDurably'] ?? $prioritized[0]['recoveryTrustDriverTransitionBalanceEscapedEntrenchmentDurably'] ?? false,
    'topRecoveryTrustDriverTransitionBalanceRecaptureCount' => $visible[0]['recoveryTrustDriverTransitionBalanceRecaptureCount'] ?? $prioritized[0]['recoveryTrustDriverTransitionBalanceRecaptureCount'] ?? 0,
    'topRecoveryTrustDriverTransitionBalanceRecapturedEntrenchment' => $visible[0]['recoveryTrustDriverTransitionBalanceRecapturedEntrenchment'] ?? $prioritized[0]['recoveryTrustDriverTransitionBalanceRecapturedEntrenchment'] ?? false,
    'topRecoveryTrustDriverTransitionBalanceRecaptureDirection' => $visible[0]['recoveryTrustDriverTransitionBalanceRecaptureDirection'] ?? $prioritized[0]['recoveryTrustDriverTransitionBalanceRecaptureDirection'] ?? 'none',
    'topRecoveryTrustDriverTransitionBalanceRecaptureStreak' => $visible[0]['recoveryTrustDriverTransitionBalanceRecaptureStreak'] ?? $prioritized[0]['recoveryTrustDriverTransitionBalanceRecaptureStreak'] ?? 0,
    'topRecoveryTrustDriverTransitionBalanceStructuralState' => $visible[0]['recoveryTrustDriverTransitionBalanceStructuralState'] ?? $prioritized[0]['recoveryTrustDriverTransitionBalanceStructuralState'] ?? 'neutral',
    'topRecoveryTrustDriverShiftAdjustment' => $visible[0]['recoveryTrustDriverShiftAdjustment'] ?? $prioritized[0]['recoveryTrustDriverShiftAdjustment'] ?? 0,
    'topRecoveryTrustDriverShiftStreakAdjustment' => $visible[0]['recoveryTrustDriverShiftStreakAdjustment'] ?? $prioritized[0]['recoveryTrustDriverShiftStreakAdjustment'] ?? 0,
    'topRecoveryTrustDriverTransitionAdjustment' => $visible[0]['recoveryTrustDriverTransitionAdjustment'] ?? $prioritized[0]['recoveryTrustDriverTransitionAdjustment'] ?? 0,
    'topRecoveryTrustDriverNegativeTransitionStreakAdjustment' => $visible[0]['recoveryTrustDriverNegativeTransitionStreakAdjustment'] ?? $prioritized[0]['recoveryTrustDriverNegativeTransitionStreakAdjustment'] ?? 0,
    'topRecoveryTrustDriverPositiveTransitionStreakBoost' => $visible[0]['recoveryTrustDriverPositiveTransitionStreakBoost'] ?? $prioritized[0]['recoveryTrustDriverPositiveTransitionStreakBoost'] ?? 0,
    'topRecoveryTrustDriverTransitionBalanceAdjustment' => $visible[0]['recoveryTrustDriverTransitionBalanceAdjustment'] ?? $prioritized[0]['recoveryTrustDriverTransitionBalanceAdjustment'] ?? 0,
    'topRecoveryTrustDriverTransitionBalanceReversalAdjustment' => $visible[0]['recoveryTrustDriverTransitionBalanceReversalAdjustment'] ?? $prioritized[0]['recoveryTrustDriverTransitionBalanceReversalAdjustment'] ?? 0,
    'topRecoveryTrustDriverTransitionBalanceReversalStreakAdjustment' => $visible[0]['recoveryTrustDriverTransitionBalanceReversalStreakAdjustment'] ?? $prioritized[0]['recoveryTrustDriverTransitionBalanceReversalStreakAdjustment'] ?? 0,
    'topRecoveryTrustDriverTransitionBalanceStabilityAdjustment' => $visible[0]['recoveryTrustDriverTransitionBalanceStabilityAdjustment'] ?? $prioritized[0]['recoveryTrustDriverTransitionBalanceStabilityAdjustment'] ?? 0,
    'topRecoveryTrustDriverTransitionBalanceEntrenchmentAdjustment' => $visible[0]['recoveryTrustDriverTransitionBalanceEntrenchmentAdjustment'] ?? $prioritized[0]['recoveryTrustDriverTransitionBalanceEntrenchmentAdjustment'] ?? 0,
    'topRecoveryTrustDriverTransitionBalanceEntrenchmentEscapeAdjustment' => $visible[0]['recoveryTrustDriverTransitionBalanceEntrenchmentEscapeAdjustment'] ?? $prioritized[0]['recoveryTrustDriverTransitionBalanceEntrenchmentEscapeAdjustment'] ?? 0,
    'topRecoveryTrustDriverTransitionBalanceEscapeDurabilityAdjustment' => $visible[0]['recoveryTrustDriverTransitionBalanceEscapeDurabilityAdjustment'] ?? $prioritized[0]['recoveryTrustDriverTransitionBalanceEscapeDurabilityAdjustment'] ?? 0,
    'topRecoveryTrustDriverTransitionBalanceRecaptureAdjustment' => $visible[0]['recoveryTrustDriverTransitionBalanceRecaptureAdjustment'] ?? $prioritized[0]['recoveryTrustDriverTransitionBalanceRecaptureAdjustment'] ?? 0,
    'topRecoveryTrustDriverTransitionBalanceRecaptureStreakAdjustment' => $visible[0]['recoveryTrustDriverTransitionBalanceRecaptureStreakAdjustment'] ?? $prioritized[0]['recoveryTrustDriverTransitionBalanceRecaptureStreakAdjustment'] ?? 0,
    'topRecoveryTrustDriverTransitionBalanceStructuralAdjustment' => $visible[0]['recoveryTrustDriverTransitionBalanceStructuralAdjustment'] ?? $prioritized[0]['recoveryTrustDriverTransitionBalanceStructuralAdjustment'] ?? 0
]);
