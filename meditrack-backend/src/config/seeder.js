require("dotenv").config();
const mongoose = require("mongoose");
const crypto = require("crypto");

// Models
const Hospital = require("../models/Hospital");
const User = require("../models/User");
const Patient = require("../models/Patient");
const Condition = require("../models/Condition");
const CheckIn = require("../models/CheckIn");
const Alert = require("../models/Alert");
const Message = require("../models/Message");

// Helper to generate dates relative to today
const getPastDate = (daysAgo) => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date;
};

// Helper for check-in generation logic
const createCheckIn = async (patient, daysAgo, scoreCategory, symptoms, hasAiFlag = false) => {
  let riskStatus = "stable";
  let overallScore = 1.0;

  if (scoreCategory === "critical") {
    riskStatus = "critical";
    overallScore = 4.0 + Math.random(); // 4.0 - 5.0
  } else if (scoreCategory === "high") {
    riskStatus = "critical";
    overallScore = 4.0 + (Math.random() * 0.5); // 4.0 - 4.5
  } else if (scoreCategory === "medium-high") {
    riskStatus = "watch";
    overallScore = 3.5 + (Math.random() * 0.4); // 3.5 - 3.9
  } else if (scoreCategory === "medium") {
    riskStatus = "watch";
    overallScore = 2.5 + (Math.random() * 0.5); // 2.5 - 3.0
  } else {
    riskStatus = "stable";
    overallScore = 1.0 + Math.random(); // 1.0 - 2.0
  }

  // Force specific symptoms
  const checkInSymptoms = symptoms.map(s => ({
    name: s.name,
    severity: s.severity,
    aiFlag: hasAiFlag,
    source: "checklist"
  }));

  const checkIn = await CheckIn.create({
    patientId: patient._id,
    date: getPastDate(daysAgo),
    symptoms: checkInSymptoms,
    overallScore: Number(overallScore.toFixed(1)),
    riskStatus,
    aiResponse: "Thank you for your daily update. Your care team has been notified.",
  });

  return checkIn;
};

const runSeeder = async () => {
  try {
    console.log("Connecting to Database...");
    await mongoose.connect(process.env.MONGODB_URI);

    console.log("Clearing existing data...");
    await Hospital.deleteMany();
    await User.deleteMany();
    await Patient.deleteMany();
    await Condition.deleteMany();
    await CheckIn.deleteMany();
    await Alert.deleteMany();
    await Message.deleteMany();

    // Pre-generate Hospital ID to resolve circular dependency
    const hospitalId = new mongoose.Types.ObjectId();

    // 1. Create Admin user FIRST
    console.log("Creating Admin User...");
    const admin = await User.create({
      name: "System Admin",
      email: "admin@meditrack.com",
      password: "Admin@123",
      role: "admin",
      hospitalId: hospitalId,
    });

    // 2. Create Hospital
    console.log("Creating Hospital...");
    const hospital = await Hospital.create({
      _id: hospitalId,
      name: "Sahyadri Specialty Hospital",
      address: "Pune, Maharashtra",
      adminId: admin._id,
    });

    // 3. Create the rest of the users
    console.log("Creating Rest of Users...");

    const drSharma = await User.create({
      name: "Dr. Sharma",
      email: "dr.sharma@meditrack.com",
      password: "Doctor@123",
      role: "doctor",
      hospitalId: hospital._id,
    });

    const drPatil = await User.create({
      name: "Dr. Patil",
      email: "dr.patil@meditrack.com",
      password: "Doctor@123",
      role: "doctor",
      hospitalId: hospital._id,
    });

    const nursePriya = await User.create({
      name: "Nurse Priya",
      email: "nurse.priya@meditrack.com",
      password: "Nurse@123",
      role: "nurse",
      hospitalId: hospital._id,
    });

    const nurseAnjali = await User.create({
      name: "Nurse Anjali",
      email: "nurse.anjali@meditrack.com",
      password: "Nurse@123",
      role: "nurse",
      hospitalId: hospital._id,
    });

    const patientUsers = [
      { name: "Rajesh Kumar", email: "patient1@meditrack.com" },
      { name: "Sunita Sharma", email: "patient2@meditrack.com" },
      { name: "Amit Patel", email: "patient3@meditrack.com" },
      { name: "Meera Joshi", email: "patient4@meditrack.com" },
      { name: "Deepak Singh", email: "patient5@meditrack.com" },
    ];

    const createdPatientUsers = [];
    for (const pu of patientUsers) {
      createdPatientUsers.push(
        await User.create({
          name: pu.name,
          email: pu.email,
          password: "Patient@123",
          role: "patient",
          hospitalId: hospital._id,
        })
      );
    }

    // 3. CONDITIONS
    console.log("Creating Conditions...");
    const cardiacCondition = await Condition.create({
      name: "cardiac",
      symptoms: [
        { label: "Chest pain/tightness" },
        { label: "Shortness of breath" },
        { label: "Swelling in legs/feet" },
        { label: "Dizziness/fainting" },
        { label: "Irregular heartbeat" },
        { label: "Fatigue" },
      ],
      createdBy: admin._id,
      hospitalId: hospital._id,
    });

    const orthoCondition = await Condition.create({
      name: "ortho",
      symptoms: [
        { label: "Surgical site pain" },
        { label: "Swelling around joint" },
        { label: "Stiffness/reduced movement" },
        { label: "Redness or warmth" },
        { label: "Numbness/tingling" },
        { label: "Fever at wound site" },
      ],
      createdBy: admin._id,
      hospitalId: hospital._id,
    });

    const diabetesCondition = await Condition.create({
      name: "diabetes",
      symptoms: [
        { label: "Unusual thirst" },
        { label: "Frequent urination" },
        { label: "Blurred vision" },
        { label: "Slow healing wound" },
        { label: "Tingling in hands/feet" },
        { label: "Energy crash after meals" },
        { label: "Nausea" },
      ],
      createdBy: admin._id,
      hospitalId: hospital._id,
    });

    // 4. PATIENTS
    console.log("Enrolling Patients...");
    const patientData = [
      { 
        uId: 0, 
        condition: "cardiac", 
        diagnosis: "Post-CABG Recovery",
        days: 10,
        age: 62,
        sex: "Male",
        phone: "+91 9876543210",
        emergencyContact: { name: "Sunita Kumar", phone: "+91 9876543211" },
        caregiverName: "Rahul Kumar",
        caregiverPhone: "+91 9876543212",
        checkInTimePreference: "morning",
        monitoringDuration: 30,
        medicines: [
          { name: "Aspirin", dosage: "75mg", frequency: "Once daily", timing: "morning", duration: "30 days" },
          { name: "Metoprolol", dosage: "25mg", frequency: "Twice daily", timing: "multiple", duration: "30 days" }
        ],
        recoveryInstructions: {
          dos: ["Walk 15 mins daily", "Keep incision clean"],
          donts: ["Lift heavy objects", "Drive for 4 weeks"],
          diet: ["Low sodium", "High fiber"],
          woundCare: ["Change dressing daily", "Report redness"],
          redFlags: ["Chest pain", "Shortness of breath at rest"]
        }
      },
      { 
        uId: 1, 
        condition: "diabetes", 
        diagnosis: "Type 2 Diabetes with foot ulcer",
        days: 7,
        age: 55,
        sex: "Female",
        phone: "+91 9876543220",
        emergencyContact: { name: "Ramesh Sharma", phone: "+91 9876543221" },
        caregiverName: "Priya Sharma",
        caregiverPhone: "+91 9876543222",
        checkInTimePreference: "evening",
        monitoringDuration: 21,
        medicines: [
          { name: "Metformin", dosage: "500mg", frequency: "Twice daily", timing: "multiple", duration: "Ongoing" },
          { name: "Insulin Glargine", dosage: "10 units", frequency: "Once daily", timing: "night", duration: "Ongoing" }
        ],
        recoveryInstructions: {
          dos: ["Check blood sugar daily", "Inspect feet daily"],
          donts: ["Walk barefoot", "Skip meals"],
          diet: ["Low carb", "No processed sugar"],
          woundCare: ["Clean ulcer with saline", "Apply prescribed ointment"],
          redFlags: ["Fever", "Pus from wound", "Sugar > 250"]
        }
      },
      { 
        uId: 2, 
        condition: "ortho", 
        diagnosis: "Total Knee Replacement",
        days: 3,
        age: 68,
        sex: "Male",
        phone: "+91 9876543230",
        emergencyContact: { name: "Geeta Patel", phone: "+91 9876543231" },
        caregiverName: "Sanjay Patel",
        caregiverPhone: "+91 9876543232",
        checkInTimePreference: "morning",
        monitoringDuration: 14,
        medicines: [
          { name: "Paracetamol", dosage: "500mg", frequency: "Thrice daily", timing: "multiple", duration: "7 days" },
          { name: "Ibuprofen", dosage: "400mg", frequency: "SOS", timing: "multiple", duration: "5 days" }
        ],
        recoveryInstructions: {
          dos: ["Use walker", "Ice pack 3x a day"],
          donts: ["Bend knee past 90 degrees", "Cross legs"],
          diet: ["High protein", "Calcium rich"],
          woundCare: ["Keep dressing dry", "Watch for swelling"],
          redFlags: ["Severe pain not relieved by meds", "Calf pain"]
        }
      },
      { 
        uId: 3, 
        condition: "cardiac", 
        diagnosis: "Heart Failure Exacerbation",
        days: 12,
        age: 72,
        sex: "Female",
        phone: "+91 9876543240",
        emergencyContact: { name: "Anand Joshi", phone: "+91 9876543241" },
        caregiverName: "Neha Joshi",
        caregiverPhone: "+91 9876543242",
        checkInTimePreference: "morning",
        monitoringDuration: 30,
        medicines: [
          { name: "Furosemide", dosage: "40mg", frequency: "Once daily", timing: "morning", duration: "30 days" },
          { name: "Lisinopril", dosage: "5mg", frequency: "Once daily", timing: "morning", duration: "30 days" }
        ],
        recoveryInstructions: {
          dos: ["Weigh yourself daily", "Restrict fluids to 1.5L"],
          donts: ["Add extra salt", "Miss medications"],
          diet: ["Strict low sodium", "Heart healthy"],
          woundCare: ["N/A"],
          redFlags: ["Weight gain > 1kg in a day", "Worsening breathlessness"]
        }
      },
      { 
        uId: 4, 
        condition: "diabetes", 
        diagnosis: "Newly Diagnosed Type 2 Diabetes",
        days: 1,
        age: 45,
        sex: "Male",
        phone: "+91 9876543250",
        emergencyContact: { name: "Pooja Singh", phone: "+91 9876543251" },
        caregiverName: "Amit Singh",
        caregiverPhone: "+91 9876543252",
        checkInTimePreference: "evening",
        monitoringDuration: 14,
        medicines: [
          { name: "Glimepiride", dosage: "1mg", frequency: "Once daily", timing: "morning", duration: "Ongoing" }
        ],
        recoveryInstructions: {
          dos: ["Maintain food diary", "Exercise 30 mins"],
          donts: ["Eat sweets", "Fast for long hours"],
          diet: ["Diabetic diet", "Frequent small meals"],
          woundCare: ["N/A"],
          redFlags: ["Dizziness", "Excessive sweating"]
        }
      },
    ];

    const patients = [];
    for (const pd of patientData) {
      patients.push(
        await Patient.create({
          userId: createdPatientUsers[pd.uId]._id,
          condition: pd.condition,
          diagnosis: pd.diagnosis,
          age: pd.age,
          sex: pd.sex,
          phone: pd.phone,
          emergencyContact: pd.emergencyContact,
          caregiverName: pd.caregiverName,
          caregiverPhone: pd.caregiverPhone,
          checkInTimePreference: pd.checkInTimePreference,
          monitoringDuration: pd.monitoringDuration,
          medicines: pd.medicines,
          recoveryInstructions: pd.recoveryInstructions,
          enrolledBy: nursePriya._id,
          dischargeDate: getPastDate(pd.days),
          monitoringEndDate: getPastDate(pd.days - pd.monitoringDuration),
          status: "active",
          hospitalId: hospital._id,
          joinCode: crypto.randomInt(100000, 999999).toString(),
        })
      );
    }

    // 5. CHECKINS & 6. ALERTS
    console.log("Generating CheckIns and Alerts...");
    let checkInsCount = 0;
    let alertsCount = 0;

    // Rajesh Kumar (cardiac, Day 10)
    for (let day = 1; day <= 10; day++) {
      let severityCat = "low";
      let hasAiFlag = false;
      let symptoms = [{ name: "Fatigue", severity: 2 }];

      if (day <= 3) {
        severityCat = "high";
        symptoms = [
          { name: "Chest pain/tightness", severity: 4 },
          { name: "Shortness of breath", severity: 4 }
        ];
        if (day <= 2) hasAiFlag = true;
      } else if (day <= 6) {
        severityCat = "medium";
        symptoms = [{ name: "Chest pain/tightness", severity: 2 }];
      }

      const ci = await createCheckIn(patients[0], 10 - day, severityCat, symptoms, hasAiFlag);
      checkInsCount++;

      if (ci.riskStatus === "critical" || ci.riskStatus === "watch") {
        await Alert.create({
          patientId: patients[0]._id,
          checkInId: ci._id,
          severity: ci.riskStatus === "critical" ? "high" : "medium",
          alertType: "triage",
          notifiedTo: [drSharma._id, nursePriya._id],
          acknowledgedAt: day === 10 ? null : getPastDate(10 - day), // latest pending
        });
        alertsCount++;
      }
    }

    // Sunita Sharma (diabetes, Day 7)
    for (let day = 1; day <= 7; day++) {
      const ci = await createCheckIn(
        patients[1], 
        7 - day, 
        "medium", 
        [{ name: "Unusual thirst", severity: 3 }],
        false
      );
      ci.overallScore = 3.0; // Force exact scores to simulate lack of improvement
      if (day >= 3) {
        ci.overallScore = 2.0; 
      }
      await ci.save();
      checkInsCount++;
      
      // Simulate trend escalation flag explicitly for Day 7
      if (day === 7) {
        await Alert.create({
          patientId: patients[1]._id,
          checkInId: ci._id,
          severity: "medium",
          alertType: "trend_escalation",
          notifiedTo: [drSharma._id],
        });
        alertsCount++;
      }
    }

    // Amit Patel (ortho, Day 3)
    for (let day = 1; day <= 3; day++) {
      const ci = await createCheckIn(
        patients[2], 
        3 - day, 
        "medium-high", 
        [{ name: "Surgical site pain", severity: 4 }],
        false
      );
      checkInsCount++;
      
      await Alert.create({
        patientId: patients[2]._id,
        checkInId: ci._id,
        severity: "medium",
        alertType: "triage",
        notifiedTo: [drSharma._id],
        acknowledgedAt: day < 3 ? getPastDate(3 - day) : null,
      });
      alertsCount++;
    }

    // Meera Joshi (cardiac, Day 12)
    for (let day = 1; day <= 12; day++) {
      let severityCat = "low";
      if (day <= 4) severityCat = "critical";
      else if (day <= 8) severityCat = "medium";
      
      const ci = await createCheckIn(
        patients[3], 
        12 - day, 
        severityCat, 
        [{ name: "Irregular heartbeat", severity: severityCat === "critical" ? 5 : severityCat === "medium" ? 3 : 1 }],
        false
      );
      checkInsCount++;

      if (ci.riskStatus === "critical") {
        await Alert.create({
          patientId: patients[3]._id,
          checkInId: ci._id,
          severity: "high",
          alertType: "triage",
          notifiedTo: [drSharma._id, nurseAnjali._id],
          acknowledgedAt: getPastDate(12 - day),
        });
        alertsCount++;
      }
    }

    // Deepak Singh (diabetes, Day 1)
    const deepakCi = await createCheckIn(
      patients[4], 
      0, 
      "high", 
      [{ name: "Nausea", severity: 4 }, { name: "Blurred vision", severity: 4 }],
      true
    );
    checkInsCount++;
    await Alert.create({
      patientId: patients[4]._id,
      checkInId: deepakCi._id,
      severity: "high",
      alertType: "triage",
      notifiedTo: [drSharma._id, nursePriya._id],
    });
    alertsCount++;


    // 7. MESSAGES
    console.log("Generating Messages...");
    const messages = [
      { senderId: nursePriya._id, senderRole: "nurse", msg: "Hi Rajesh, how are you feeling today?", day: 9 },
      { senderId: createdPatientUsers[0]._id, senderRole: "patient", msg: "I am feeling very uncomfortable in my chest.", day: 9 },
      { senderId: drSharma._id, senderRole: "doctor", msg: "Rajesh, please ensure you are taking the blue pill prescribed. If the pain radiates to your arm, go to the ER immediately.", day: 8 },
      { senderId: createdPatientUsers[0]._id, senderRole: "patient", msg: "I took the pill, feeling slightly better today.", day: 7 },
      { senderId: drSharma._id, senderRole: "doctor", msg: "Great progress, keep resting.", day: 5 },
    ];

    for (const m of messages) {
      await Message.create({
        patientId: patients[0]._id,
        senderId: m.senderId,
        senderRole: m.senderRole,
        message: m.msg,
        createdAt: getPastDate(m.day),
        readAt: getPastDate(m.day - 0.1), // Mark as read shortly after
      });
    }

    console.log("\nSeeder complete:");
    console.log("  1 Hospital");
    console.log("  5 Users (1 admin, 2 doctors, 2 nurses)");
    console.log("  5 Patients enrolled");
    console.log("  3 Condition templates");
    console.log(`  ${checkInsCount} CheckIns created`);
    console.log(`  ${alertsCount} Alerts created`);
    console.log(`  ${messages.length} Messages created`);
    console.log("");
    
    process.exit(0);
  } catch (error) {
    console.error("Seeder failed:", error);
    process.exit(1);
  }
};

runSeeder();
