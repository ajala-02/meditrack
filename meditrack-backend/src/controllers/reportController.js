const PDFDocument = require("pdfkit");
const Patient = require("../models/Patient");
const CheckIn = require("../models/CheckIn");

/**
 * GET /api/reports/:patientId
 * Generates a full recovery PDF with all check-ins and responses.
 */
const generatePatientReport = async (req, res) => {
  try {
    const patientId = req.params.patientId;

    const patient = await Patient.findById(patientId)
      .populate("userId", "name email")
      .populate("enrolledBy", "name")
      .lean();

    if (!patient) {
      return res.status(404).json({ message: "Patient not found." });
    }

    // Verify hospital access
    if (patient.hospitalId.toString() !== req.user.hospitalId) {
      return res.status(403).json({ message: "Access denied." });
    }

    const checkIns = await CheckIn.find({ patientId: patient._id })
      .sort({ date: 1 })
      .populate("respondedBy", "name")
      .lean();

    // Create a PDF Document
    const doc = new PDFDocument({ margin: 50 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=recovery_report_${patient.userId.name.replace(/\s+/g, "_")}.pdf`
    );

    doc.pipe(res);

    // Header
    doc.fontSize(24).text("MediTrack Recovery Report", { align: "center" });
    doc.moveDown();
    
    // Patient Info
    doc.fontSize(14).text(`Patient Name: ${patient.userId.name}`);
    doc.fontSize(12).text(`Condition: ${patient.condition.charAt(0).toUpperCase() + patient.condition.slice(1)}`);
    doc.text(`Discharge Date: ${new Date(patient.dischargeDate).toLocaleDateString()}`);
    doc.text(`Status: ${patient.status}`);
    doc.moveDown(2);

    // Check-ins
    doc.fontSize(18).text("Daily Check-In History", { underline: true });
    doc.moveDown();

    if (checkIns.length === 0) {
      doc.fontSize(12).text("No check-ins recorded yet.");
    } else {
      checkIns.forEach((ci, index) => {
        doc.fontSize(14).fillColor("black").text(`Day ${index + 1} - ${new Date(ci.date).toLocaleString()}`);
        doc.fontSize(12).fillColor("gray").text(`Risk Status: ${ci.riskStatus.toUpperCase()} (Score: ${ci.overallScore.toFixed(1)})`);
        
        doc.moveDown(0.5);
        doc.fontSize(12).fillColor("black").text("Symptoms:");
        ci.symptoms.forEach(s => {
          doc.fontSize(10).fillColor(s.aiFlag ? "red" : "black").text(`  • ${s.name} (Severity: ${s.severity}) ${s.aiFlag ? '[AI FLAGGED]' : ''}`);
        });

        const nextStep = ci.riskStatus === "critical"
          ? "Urgent: contact emergency services or your care team immediately if symptoms are severe or worsening."
          : ci.riskStatus === "watch"
            ? "Monitor closely and follow the care team's instructions. Your update has been flagged for review."
            : "Continue your recovery plan and report any new or worsening symptoms in your next check-in.";
        doc.moveDown(0.5);
        doc.fontSize(10).fillColor("black").text(`Suggested next step: ${nextStep}`);

        if (ci.aiResponse) {
          doc.moveDown(0.5);
          doc.fontSize(10).fillColor("blue").text(`AI Note: ${ci.aiResponse}`);
        }

        if (ci.doctorResponse) {
          doc.moveDown(0.5);
          doc.fontSize(10).fillColor("green").text(`Clinician Response (${ci.respondedBy?.name || 'Staff'}): ${ci.doctorResponse}`);
        }

        doc.moveDown(1.5);
      });
    }

    doc.moveDown();
    doc.fontSize(9).fillColor("gray").text("This report summarizes patient-reported information and automated support guidance. It is not a medical diagnosis and does not replace advice from a qualified clinician.");

    doc.end();
  } catch (error) {
    // If headers already sent, we can't send JSON
    if (!res.headersSent) {
      res.status(500).json({ message: "Failed to generate report.", error: error.message });
    }
  }
};

/**
 * GET /api/reports/me
 * Lets a patient download only their own recovery report.
 */
const generateMyReport = async (req, res) => {
  try {
    const patient = await Patient.findOne({ userId: req.user.id }).select("_id").lean();
    if (!patient) {
      return res.status(404).json({ message: "Patient record not found." });
    }
    req.params.patientId = patient._id.toString();
    return generatePatientReport(req, res);
  } catch (error) {
    return res.status(500).json({ message: "Failed to generate your report.", error: error.message });
  }
};

module.exports = {
  generatePatientReport,
  generateMyReport,
};
