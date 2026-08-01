const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic.default({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = "claude-sonnet-4-20250514";

/**
 * Analyse free-text / voice-transcribed symptom description.
 * Returns structured symptom data the check-in form can consume.
 *
 * @param {string} text          – Raw patient description
 * @param {string} condition     – Patient's condition (cardiac, ortho, etc.)
 * @param {string} [language]    – Optional language hint (en, hi, mr)
 * @returns {Promise<{
 *   name: string,
 *   severity: number,
 *   aiFlag: boolean,
 *   flagNote: string,
 *   possibleExplanation: string,
 *   nextStep: string,
 *   urgency: "routine" | "monitor" | "urgent"
 * }>}
 */
const analyzeSymptomText = async (text, condition, language = "en") => {
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: `You are a medical symptom extraction assistant for a post-discharge monitoring system.

The patient has the following condition: ${condition}
The patient described their symptom in this language: ${language}

Patient's description:
"${text}"

Extract the following and return ONLY valid JSON (no markdown, no code fences):
{
  "name": "concise symptom name in English",
  "severity": <number 1-5 where 1=mild, 5=severe>,
  "aiFlag": <true if the symptom could indicate a serious complication for a ${condition} patient, false otherwise>,
  "flagNote": "brief clinical note explaining why this was flagged, empty string if not flagged",
  "possibleExplanation": "one short, non-diagnostic sentence describing why this can matter in recovery",
  "nextStep": "one conservative, actionable next step for the patient",
  "urgency": "routine", "monitor", or "urgent"
}

Severity guide:
1 = Mild discomfort, expected post-discharge
2 = Noticeable but manageable
3 = Moderate, warrants monitoring
4 = Significant, may need medical attention
5 = Severe, potentially dangerous

Be conservative with severity — only use 4-5 for genuinely concerning symptoms.
Set aiFlag=true ONLY for symptoms that could indicate serious complications like infection, blood clots, cardiac events, wound dehiscence, organ failure, or rapid deterioration.`,
        },
      ],
    });

    const content = response.content[0].text.trim();
    const parsed = JSON.parse(content);

    // Validate and clamp values
    return {
      name: String(parsed.name || "Unknown symptom").substring(0, 100),
      severity: Math.min(5, Math.max(1, Math.round(Number(parsed.severity) || 3))),
      aiFlag: Boolean(parsed.aiFlag),
      flagNote: String(parsed.flagNote || ""),
      possibleExplanation: String(parsed.possibleExplanation || "This symptom should be considered alongside your recovery plan."),
      nextStep: String(parsed.nextStep || "Continue monitoring and share any change with your care team."),
      urgency: ["routine", "monitor", "urgent"].includes(parsed.urgency)
        ? parsed.urgency
        : (parsed.aiFlag ? "urgent" : "monitor"),
    };
  } catch (error) {
    console.error("Claude symptom analysis failed:", error.message);

    // Fallback: return a safe default so check-in is never blocked
    return {
      name: text.substring(0, 100),
      severity: 3,
      aiFlag: false,
      flagNote: "AI analysis unavailable — manual review recommended.",
      possibleExplanation: "We could not generate clinical context for this update.",
      nextStep: "Please include this symptom in your check-in so your care team can review it.",
      urgency: "monitor",
    };
  }
};

/**
 * Generate an immediate AI response to the patient after a check-in.
 *
 * @param {Array} symptoms       – Processed symptoms array
 * @param {string} riskStatus    – "stable" | "watch" | "critical"
 * @param {string} condition     – Patient's condition
 * @param {string} [language]    – Response language (en, hi, mr)
 * @returns {Promise<string>}    – Patient-friendly response
 */
const generateCheckInResponse = async (symptoms, riskStatus, condition, language = "en") => {
  try {
    const symptomList = symptoms
      .map((s) => `- ${s.name} (severity: ${s.severity}/5)`)
      .join("\n");

    const languageInstruction =
      language === "hi"
        ? "Respond in Hindi (Devanagari script)."
        : language === "mr"
          ? "Respond in Marathi (Devanagari script)."
          : "Respond in English.";

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: `You are a compassionate medical assistant providing post-discharge follow-up for a ${condition} patient.

The patient just submitted their daily check-in with these symptoms:
${symptomList}

Risk assessment: ${riskStatus}

${languageInstruction}

Provide a brief, reassuring response (3-5 sentences) that:
1. Acknowledges their symptoms
2. Gives appropriate advice based on severity
3. If critical: urge them to seek immediate help and mention their care team has been alerted
4. If watch: reassure them their doctor has been notified
5. If stable: encourage them to continue monitoring

IMPORTANT: You are NOT diagnosing. You are providing comfort and guidance.
Never say "I'm an AI" — speak as "your MediTrack care assistant".
Keep it warm, professional, and concise.`,
        },
      ],
    });

    return response.content[0].text.trim();
  } catch (error) {
    console.error("Claude check-in response failed:", error.message);

    // Fallback responses by risk level
    const fallbacks = {
      critical:
        "Thank you for your check-in. Some of your symptoms need attention — your care team has been alerted and will reach out to you shortly. If you feel your condition is worsening rapidly, please visit the nearest emergency room.",
      watch:
        "Thank you for your check-in. Your doctor has been notified about your symptoms and will review them soon. Please continue to rest and follow your discharge instructions.",
      stable:
        "Thank you for your check-in. Your recovery seems to be on track. Keep following your prescribed routine and reach out if anything changes.",
    };

    return fallbacks[riskStatus] || fallbacks.stable;
  }
};

module.exports = { analyzeSymptomText, generateCheckInResponse };
