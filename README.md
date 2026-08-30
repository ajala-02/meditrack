<div align="center">

<img src="https://img.shields.io/badge/MediTrack-Healthcare%20Platform-06b6d4?style=for-the-badge&logo=heart&logoColor=white" />

# MediTrack
### AI-Powered Post-Discharge Patient Monitoring Platform

*Hospitals discharge patients. MediTrack makes sure they don't lose sight of them.*

[![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![React Native](https://img.shields.io/badge/React_Native-61DAFB?style=flat-square&logo=react&logoColor=black)](https://reactnative.dev/)
[![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://mongodb.com/)
[![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=flat-square&logo=socketdotio&logoColor=white)](https://socket.io/)
[![Express](https://img.shields.io/badge/Express-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com/)

</div>

---

## The Problem

Every year, millions of patients are discharged from Indian hospitals and sent home with a printed instruction sheet and a follow-up date two weeks away. What happens in between is a complete blind spot.

> **Over 20% of patients are readmitted within 30 days** — most due to complications that developed silently at home and were caught too late.

Nurses can't call 200 patients daily. WhatsApp groups are chaotic. Wearable monitors are expensive. Paper follow-ups get lost. There was no unified, software-only solution built specifically for Indian hospitals — until MediTrack.

---

## What MediTrack Does

MediTrack bridges the gap between hospital discharge and full recovery by giving:

- 📱 **Patients** — a mobile app for daily symptom check-ins, AI health companion, and recovery tracking
- 🖥️ **Nurses & Doctors** — a real-time web dashboard with live risk scores, alerts, and patient messaging
- 🏥 **Hospitals** — a complete post-discharge monitoring system with zero hardware required

---

## How It Works

```
🏥 Nurse enrolls patient at discharge (30 seconds)
        ↓
📱 Patient gets WhatsApp join code → downloads app
        ↓
✍️  Patient does daily symptom check-in
        ↓
🤖 AI analyzes symptoms instantly
        ↓
📊 Triage algorithm scores severity
        ↓
        ├── Low  → Nurse notified
        ├── Med  → Doctor notified  
        └── High → Instant alert to both 🚨
        ↓
💬 Doctor responds → Patient notified instantly
        ↓
📈 Recovery tracked over 14-30 days
        ↓
📄 Auto-generated PDF report at end of monitoring
```

---

## Features

### 🤖 AI-Powered Intelligence
- **Voice symptom input** — patient speaks in Hindi, Marathi, or English; AI extracts symptoms automatically
- **AI Health Companion** — conversational AI explains why symptoms happen, suggests home remedies, answers questions in any language
- **Auto-generated recovery instructions** — nurse enters diagnosis, Claude/Groq AI generates personalized do's, don'ts, diet, wound care, and red flags
- **Smart triage** — AI responds instantly so patients are never left waiting while clinicians review every check-in

### 📊 3-Tier Triage System
```
Score = (maxSeverity × 0.4) + (avgSeverity × 0.3) + 
        (symptomCount × 0.2) + (hasAIFlag ? 1.5 : 0)

< 2.5  →  Stable   →  Nurse notified
2.5-4  →  Watch    →  Doctor notified
≥ 4    →  Critical →  Instant alert to all 🚨
```
Every check-in is saved regardless of severity. **AI never replaces doctors — it assists them.**

### 🗺️ Symptom Body Map
Patients tap where it hurts on an interactive body diagram instead of filling medical forms. Zones highlight in teal, severity is rated 1-5, and unlisted symptoms can be added via voice or text.

### 📈 Comparative Recovery Timeline
Visual chart comparing the patient's actual recovery curve against the expected healing trajectory for their condition — updated daily as check-ins come in.

### 🏆 Streak & Milestone Badges
Gamified recovery tracking — patients earn badges for consistency, milestones, and medicine adherence. Keeps elderly patients engaged throughout the monitoring period.

### 💬 Real-time Messaging
WhatsApp-style chat between patient and care team. Quick reply chips for common messages. AI-assisted reply suggestions for nurses based on patient symptoms.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Node.js, Express.js |
| **Database** | MongoDB + Mongoose |
| **Real-time** | Socket.io |
| **Auth** | JWT (access + refresh tokens), RBAC |
| **AI** | Groq API (LLaMA) / Anthropic Claude API |
| **Web Frontend** | React, TailwindCSS, Recharts |
| **Mobile App** | React Native (Expo) |
| **Notifications** | Expo Push, Nodemailer, Twilio WhatsApp |
| **PDF Reports** | pdfkit |
| **Deployment** | Railway (backend), Vercel (web), Expo EAS (mobile) |

---

## Project Structure

```
meditrack/
├── meditrack-backend/          # Node.js + Express API
│   ├── src/
│   │   ├── config/             # DB connection, seeder
│   │   ├── controllers/        # Business logic
│   │   ├── middleware/         # Auth, RBAC
│   │   ├── models/             # Mongoose schemas
│   │   ├── routes/             # API endpoints
│   │   ├── services/           # AI, notifications
│   │   ├── socket/             # Real-time events
│   │   └── utils/              # Helpers, scoring
│   └── server.js
│
├── web/                        # React Dashboard
│   └── src/
│       ├── pages/
│       │   ├── auth/           # Login
│       │   ├── dashboard/      # Nurse/Doctor view
│       │   ├── patients/       # Patient management
│       │   └── admin/          # Admin panel
│       ├── context/            # Auth context
│       └── hooks/              # Socket, alerts
│
└── mobile/                     # React Native (Expo)
    └── src/
        └── screens/
            ├── auth/           # Login + onboarding
            ├── checkin/        # Daily check-in flow
            ├── messages/       # Care team chat
            └── timeline/       # Recovery timeline
```

---

## Database Schema

```
Users          → name, email, role, hospitalId
Patients       → condition, diagnosis, medicines, 
                 recoveryInstructions, caregiverId
CheckIns       → symptoms[], overallScore, riskStatus,
                 aiResponse, doctorResponse
Conditions     → symptom templates per condition
Messages       → patient ↔ care team threads
Alerts         → triage notifications
AuditLogs      → every clinical action logged
Hospitals      → multi-tenant isolation
```

---

## API Endpoints

```
POST   /api/auth/login                    Login
POST   /api/auth/refresh                  Refresh token

POST   /api/patients/enroll               Enroll patient
POST   /api/patients/generate-instructions AI recovery plan
GET    /api/patients                      All patients (hospital)
GET    /api/patients/:id                  Patient detail

POST   /api/checkins                      Submit check-in
POST   /api/checkins/analyze              AI symptom analysis
GET    /api/checkins/:patientId           Check-in history
POST   /api/checkins/:id/respond          Doctor response

GET    /api/dashboard                     Live risk scores
GET    /api/alerts                        Pending alerts
GET    /api/reports/:patientId/pdf        Recovery PDF
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- MongoDB Atlas account
- Groq API key (free at console.groq.com)

### Backend Setup
```bash
cd meditrack-backend
npm install
cp .env.example .env
# Fill in your .env values
npm run seed        # populate database
npm run dev         # start server on port 5000
```

### Web Dashboard
```bash
cd web
npm install
npm run dev         # starts on localhost:5173
```

### Mobile App
```bash
cd mobile
npm install
npx expo start      # scan QR with Expo Go app
```

### Environment Variables
```env
PORT=5000
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your_secret
JWT_REFRESH_SECRET=your_refresh_secret
CLIENT_URL=http://localhost:5173
GROQ_API_KEY=your_groq_key
```

---

## Test Credentials

After running `npm run seed`:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@meditrack.com | Admin@123 |
| Doctor | dr.sharma@meditrack.com | Doctor@123 |
| Nurse | nurse.priya@meditrack.com | Nurse@123 |
| Patient | patient1@meditrack.com | Patient@123 |

---

## User Roles

| Role | Platform | Access |
|------|----------|--------|
| **Patient** | Mobile app | Check-ins, AI companion, messages, timeline |
| **Nurse** | Web dashboard | Low severity alerts, messaging, patient list |
| **Doctor** | Web dashboard | Medium/high alerts, responses, trend charts |
| **Admin** | Web dashboard | Hospital setup, staff management, analytics |

---

## What Makes MediTrack Different

| Feature | MediTrack | Existing Solutions |
|---------|-----------|-------------------|
| Hardware required | ❌ None | ✅ Expensive wearables |
| Works for any condition | ✅ Configurable | ❌ Disease-specific |
| Indian languages | ✅ Hindi, Marathi | ❌ English only |
| AI triage | ✅ Real-time | ❌ Manual review |
| Voice symptom input | ✅ Yes | ❌ No |
| Tier-2/3 city ready | ✅ WhatsApp + SMS | ❌ App-only |
| Cost | ✅ Software only | ❌ Hardware + software |

---

## Built By

**Ajala Nalawade**  
Computer Science Student, MIT-WPU Pune  
Intern, Inspira Enterprise

---

<div align="center">

*Built for the 60 million patients discharged from Indian hospitals every year.*

</div>
