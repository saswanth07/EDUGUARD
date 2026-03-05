# 🛡️ EduGuardian 2.0

### AI-Powered Anti-Cheating Proctoring System (Offline + Online)

EduGuardian 2.0 is a next-generation exam proctoring platform that uses AI to detect cheating behaviors in real-time. It features client-side AI inference (MediaPipe), blockchain-verified audit trails, and a comprehensive analytics dashboard for invigilators and admins.

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    React Frontend (Vite)                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐   │
│  │ Student   │ │Invigilator│ │  Admin   │ │ Client-side AI│   │
│  │ Exam UI   │ │ Dashboard │ │Dashboard │ │ (Canvas API)  │   │
│  └──────────┘ └──────────┘ └──────────┘ └───────────────┘   │
│  IndexedDB (Offline) │ WebSocket │ REST API                  │
└──────────────────────┼───────────┼───────────────────────────┘
                       │           │
┌──────────────────────┼───────────┼───────────────────────────┐
│              Spring Boot Backend (Java 17)                    │
│  ┌──────┐ ┌──────┐ ┌───────┐ ┌────────┐ ┌──────────────┐   │
│  │ Auth │ │ Exam │ │Proctor│ │  Risk  │ │  Blockchain  │   │
│  │ JWT  │ │ CRUD │ │ Logs  │ │ Engine │ │   Logger     │   │
│  └──────┘ └──────┘ └───────┘ └────────┘ └──────────────┘   │
│  PDF Generator │ WebSocket STOMP │ JPA Repositories          │
└────────────────┼─────────────────┼───────────────────────────┘
                 │                 │
┌────────────────┼──┐  ┌──────────┼────────────────────────────┐
│    MySQL 8.0      │  │     Python AI Service (FastAPI)        │
│  9 Tables         │  │  YOLOv8-tiny │ Whisper │ OpenCV        │
│  Triggers         │  │  Risk Fusion Engine                    │
│  Stored Procs     │  └───────────────────────────────────────┘
└───────────────────┘
```

---

## ✨ Features

### AI Detection
- 👁️ **Visual AI (MediaPipe 2.0)**: Enhanced face count detection, gaze tracking, head pose estimation (Yaw/Pitch), and multi-person detection.
- 🔊 **Audio AI**: Whisper-powered transcript analysis, decibel monitoring, and voice count detection.
- 🖥️ **Browser & OS Monitoring**: Accurate tab switching detection (synced to specific exam IDs), copy/paste tracking, and focus loss monitoring.
- 📊 **Dynamic Risk Engine**: 7-category scoring model (0-100) that fuses signals from visual, audio, and browser monitors.

## Advanced Features
- 📴 **Smart Offline Mode**: Local storage via IndexedDB with auto-sync capability once connection is restored.
- 🔗 **Blockchain Verified Logs**: SHA-256 hash chaining for all proctoring events to ensure tamper-proof records.
- 📄 **Automated Reporting**: Instant PDF report generation for every student, detailing their risk timeline and violations.
- 🤖 **AI Question Generator**: Integrated with Google Gemini to generate high-quality MCQs and descriptive questions based on topics and difficulty levels.

### UI / UX
- ✨ **Premium Aesthetics**: Glassmorphism design system using Indigo/Cyan gradients.
- 📈 **Real-time Visualization**: Live risk gauges, activity feeds, and performance charts for invigilators.

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+
- **Java** 17 (JDK)
- **Python** 3.10+
- **MySQL** 8.0 (Environment configured for `application.properties`)

### 1. Frontend
```bash
cd EDUGUARDFRONTEND
npm install
npm run dev
# Opens at http://localhost:5173
```

### 2. Backend
```bash
cd BACKEND/EDUGARD
# Auto-generates tables on first run via Hibernate
mvn spring-boot:run
# API at http://localhost:8080
```

### 3. AI Service
```bash
cd ai-service
pip install -r requirements.txt
python main.py
# API at http://localhost:8000
```

---

## 👤 Default Credentials

| Role | Username | Password |
|------|----------|----------|
| Admin | `admin` | `admin123` |
| Invigilator | `invigilator1` | `invig123` |
| Student | `student1` | `student123` |

---

## � Risk Score Model

| Category | Weight | Triggers |
|----------|--------|----------|
| Eye Deviation | 20% | Looking away from screen, gaze deviation |
| Multi-Face | 10% | Multiple persons detected in frame |
| Phone Detection | 20% | Object detection (phone, book, laptop) |
| Audio Whisper | 15% | Speech detection beyond threshold |
| Tab Switch | 15% | Tab switching, window blur, resizing |
| Head Pose | 10% | Frequent head turns or looking down |
| Movement | 10% | Sudden or suspicious movements |

**Risk Levels:** 🟢 **LOW** (0-39) | 🟡 **MEDIUM** (40-59) | 🟠 **HIGH** (60-79) | 🔴 **CRITICAL** (80-100)

---

## 📁 Project Structure

```bash
EDUGUARD/
├── BACKEND/                  # Spring Boot (Java) - Core Logic & Blockchain
├── EDUGUARDFRONTEND/         # React - UI & Client-side Detection
├── ai-service/               # FastAPI (Python) - Advanced AI Fusion
└── database/                 # SQL Schemas & Initial Data
```

---

