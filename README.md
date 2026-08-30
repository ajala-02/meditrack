<div align="center">

# 🏥 MediTrack
### AI-Powered Post-Discharge Patient Monitoring Platform

*Hospitals discharge patients. MediTrack makes sure they don't lose sight of them.*

[![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![React Native](https://img.shields.io/badge/React_Native-61DAFB?style=flat-square&logo=react&logoColor=black)](https://reactnative.dev/)
[![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://mongodb.com/)
[![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=flat-square&logo=socketdotio&logoColor=white)](https://socket.io/)

</div>

---

## The Problem

Every year, millions of patients are discharged from Indian hospitals and sent home with a printed instruction sheet and a follow-up date. What happens in between is a complete blind spot — over **20% of patients are readmitted within 30 days** due to complications that developed silently at home and were caught too late.

MediTrack fixes this.

---

## What is MediTrack?

MediTrack is a full-stack healthcare platform that gives hospitals complete visibility into their discharged patients through:

- 📱 A **mobile app** for patients to do daily symptom check-ins
- 🖥️ A **web dashboard** for nurses and doctors to monitor all patients in real time
- 🤖 **AI-powered triage** that routes alerts to the right person based on severity
- 💬 **Two-way messaging** between patients and their care team

---

## Key Features

- **Condition-specific check-ins** — Cardiac, Ortho, Diabetes and more
- **Symptom body map** — tap where it hurts instead of filling medical forms
- **Voice input** — speak in Hindi, Marathi or English, AI extracts symptoms automatically
- **AI Health Companion** — conversational AI explains symptoms, suggests home care, answers questions in any language
- **3-tier triage system** — low severity → nurse, medium → doctor, high → instant alert to both
- **Real-time alerts** — Socket.io powered live dashboard, no page refresh needed
- **Comparative recovery timeline** — patient's actual recovery vs expected healing curve
- **Streak and milestone badges** — keeps patients engaged throughout monitoring
- **Auto-generated recovery instructions** — AI generates personalized do's, don'ts, diet and red flags from diagnosis
- **PDF recovery report** — auto-generated at end of monitoring period

---

## Tech Stack

**Backend** — Node.js, Express.js, MongoDB, Socket.io, JWT  
**Web** — React, TailwindCSS, Recharts  
**Mobile** — React Native (Expo)  
**AI** — Groq API (LLaMA)  
**Notifications** — Expo Push, Nodemailer, Twilio WhatsApp  

---

## Getting Started

### Backend
```bash
cd meditrack-backend
npm install
cp .env.example .env
# Fill in your .env values
npm run seed
npm run dev
```

### Web Dashboard
```bash
cd web
npm install
npm run dev
```

### Mobile App
```bash
cd mobile
npm install
npx expo start
```

---

## Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@meditrack.com | Admin@123 |
| Doctor | dr.sharma@meditrack.com | Doctor@123 |
| Nurse | nurse.priya@meditrack.com | Nurse@123 |
| Patient | patient1@meditrack.com | Patient@123 |

---

## Built By

**Ajala Nalawade**  
Computer Science Student, MIT-WPU Pune  
Intern, Inspira Enterprise

---

<div align="center">

*Built for the 60 million patients discharged from Indian hospitals every year.*

</div>
