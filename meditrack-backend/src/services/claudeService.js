const Groq = require("groq-sdk");

const client = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const MODEL = process.env.GROQ_MODEL || "qwen/qwen3.8-27b";

const createCompletion = async ({ system, messages, max_tokens }) => {
  const response = await client.chat.completions.create({
    model: MODEL,
    max_tokens,
    messages: [{ role: "system", content: system }, ...messages],
  });
  return response.choices[0].message.content.trim();
};

const COMPANION_SYSTEM_PROMPT = (patientName, condition, day, total) => `You are a compassionate medical AI assistant for post-discharge patients in India.
Patient: ${patientName || "the patient"}, Condition: ${condition || "recovery"}, Day ${day || 1} of ${total || 30} days recovery.

Respond in the SAME language the patient used (Hindi, Marathi, or English — detect automatically).

Structure your response EXACTLY in this order, using these headings:

1. 🔍 What you described
- Summarize the patient's concern in simple language.

2. 📋 Why this may be happening
- Explain 2-3 possible, non-diagnostic reasons in plain language.
- Clearly say when the cause cannot be determined without a clinician.

3. 🏠 Home remedies and immediate care
- Give 3-5 safe, practical steps the patient can take at home.
- Never recommend changing or stopping prescribed medicines.

4. 🚶 Exercise and movement
- Suggest only gentle, appropriate movement if it is reasonably safe.
- Include duration and limits when useful.
- If symptoms could be serious, say to rest and avoid exercise until the care team advises.

5. 👀 Symptoms to monitor
- List specific symptoms or changes to watch for over the next 24 hours.

6. ⚠️ Contact your doctor or seek urgent help if
- Give clear escalation thresholds.
- For chest pain, severe breathing difficulty, fainting, sudden weakness, or rapidly worsening symptoms, advise urgent medical care immediately.

7. 📝 Detailed recovery report
- Summarize the reported concern, possible explanations, recommended actions, exercise guidance, warning signs, and what the patient should tell their care team.
- Keep this report specific to the patient's message and condition, but do not diagnose.

Your care team has been notified about this conversation.

RULES:
- Never diagnose
- Never say stop taking medicines
- Never replace doctor advice
- Always encourage care team contact for serious symptoms
- Do not invent measurements, test results, medications, or diagnoses.
- Keep language simple and reassuring`;

const generateCompanionReply = async ({ messages, patientName, condition, day, total }) => {
  return createCompletion({
    system: COMPANION_SYSTEM_PROMPT(patientName, condition, day, total),
    max_tokens: 1200,
    messages: messages.map((item) => ({ role: item.role === "assistant" ? "assistant" : "user", content: item.content })),
  });
};

const extractVoiceCheckIn = async ({ text, patientName, condition, day, total }) => {
  const content = await createCompletion({
    system: "Extract post-discharge patient voice notes. Return ONLY valid JSON. Never diagnose.",
    max_tokens: 700,
    messages: [{ role: "user", content: `Patient: ${patientName || "patient"}. Condition: ${condition || "recovery"}. Day ${day || 1} of ${total || 30}.\nVoice transcript:\n${text}\n\nReturn exactly: {"symptoms":[{"name":"","severity":1,"bodyPart":""}],"medicationTaken":true,"energyLevel":3,"activityCompleted":"","overallMood":"","aiSummary":"","urgencyFlag":false}. Use severity and energyLevel from 1-5.` }],
  });
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Claude returned invalid extraction data.");
  const parsed = JSON.parse(match[0]);
  return {
    symptoms: Array.isArray(parsed.symptoms) ? parsed.symptoms.map((item) => ({ name: String(item.name || "Reported symptom"), severity: Math.min(5, Math.max(1, Number(item.severity) || 3)), bodyPart: String(item.bodyPart || "") })) : [],
    medicationTaken: Boolean(parsed.medicationTaken),
    energyLevel: Math.min(5, Math.max(1, Number(parsed.energyLevel) || 3)),
    activityCompleted: String(parsed.activityCompleted || ""),
    overallMood: String(parsed.overallMood || ""),
    aiSummary: String(parsed.aiSummary || ""),
    urgencyFlag: Boolean(parsed.urgencyFlag),
  };
};

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
    const content = await createCompletion({
      max_tokens: 512,
      system: "You are a medical symptom extraction assistant.",
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

    const content = await createCompletion({
      max_tokens: 512,
      system: "You are a compassionate medical assistant.",
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

    return content;
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

module.exports = { analyzeSymptomText, generateCheckInResponse, generateCompanionReply, extractVoiceCheckIn, COMPANION_SYSTEM_PROMPT };
