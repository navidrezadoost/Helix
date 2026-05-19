<?php

namespace Helix\Schema\Evolution;

class PolicyDecision {
    public function __construct(
        public bool $allowed, 
        public string $reason
    ) {}
}

class CompatibilityPolicyEngine {
    public function __construct(
        private string $maxAllowedRisk = RiskLevel::MODERATE
    ) {}

    public function evaluate(CompatibilityReport $report, bool $force = false): PolicyDecision {
        $highestRisk = $report->getHighestRiskLevel();
        $severity = RiskLevel::severity($highestRisk);
        $maxSeverity = RiskLevel::severity($this->maxAllowedRisk);

        if ($severity <= $maxSeverity) {
            return new PolicyDecision(true, "Risk level '{$highestRisk}' is within allowed policy limits.");
        }

        if ($force && $severity <= RiskLevel::severity(RiskLevel::HIGH)) {
            // Note: In a real system, you would emit an auditable log entry here.
            return new PolicyDecision(true, "HIGH risk deployment bypassed via explicit force flag.");
        }

        if ($force && $severity === RiskLevel::severity(RiskLevel::CRITICAL)) {
            return new PolicyDecision(false, "CRITICAL semantic risk deployments cannot be forced.");
        }

        return new PolicyDecision(false, "Deployment risk '{$highestRisk}' exceeds policy threshold '{$this->maxAllowedRisk}'. Require explicitly forced bypass.");
    }
}