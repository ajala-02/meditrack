/**
 * Triage scoring engine for MediTrack.
 *
 * Formula:
 *   score = (maxSeverity × 0.4) + (avgSeverity × 0.3)
 *         + (symptomCount × 0.2) + (hasAIFlag ? 1.5 : 0)
 *
 * Risk levels:
 *   stable   → score < 2.5
 *   watch    → score 2.5 – 3.9
 *   critical → score ≥ 4  OR  hasAIFlag
 */

/**
 * Calculate the triage score and risk status from a symptoms array.
 * @param {Array<{ severity: number, aiFlag?: boolean }>} symptoms
 * @returns {{ overallScore: number, riskStatus: string, hasAIFlag: boolean }}
 */
const calculateTriageScore = (symptoms) => {
  if (!symptoms || symptoms.length === 0) {
    return { overallScore: 0, riskStatus: "stable", hasAIFlag: false };
  }

  const severities = symptoms.map((s) => s.severity);
  const maxSeverity = Math.max(...severities);
  const avgSeverity = severities.reduce((a, b) => a + b, 0) / severities.length;
  const symptomCount = symptoms.length;
  const hasAIFlag = symptoms.some((s) => s.aiFlag === true);

  const score =
    maxSeverity * 0.4 +
    avgSeverity * 0.3 +
    symptomCount * 0.2 +
    (hasAIFlag ? 1.5 : 0);

  // Round to 2 decimal places
  const overallScore = Math.round(score * 100) / 100;

  // Determine risk status
  let riskStatus;
  if (overallScore >= 4 || hasAIFlag) {
    riskStatus = "critical";
  } else if (overallScore >= 2.5) {
    riskStatus = "watch";
  } else {
    riskStatus = "stable";
  }

  return { overallScore, riskStatus, hasAIFlag };
};

/**
 * Map risk status to alert severity (for the Alert model).
 * @param {string} riskStatus
 * @returns {string} "low" | "medium" | "high"
 */
const riskToAlertSeverity = (riskStatus) => {
  const map = { stable: "low", watch: "medium", critical: "high" };
  return map[riskStatus] || "low";
};

module.exports = { calculateTriageScore, riskToAlertSeverity };
