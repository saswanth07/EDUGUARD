# 🧪 EduGuardian 2.0 Testing Guide

Follow these steps to verify that the system is working correctly with live data.

## 1. Environment Setup

Ensure all three services are running:
- **Backend (Spring Boot)**: `mvn spring-boot:run` (Port 8080)
- **AI Service (FastAPI)**: `uvicorn main:app --port 8000` (Port 8000)
- **Frontend (React)**: `npm run dev` (Port 5173)

---

## 2. Test Cases

### Scenario A: New User Registration & Login
1. Open the website at `http://localhost:5173`.
2. Click **"Create one"** to go to the Registration page.
3. Register a new user with the role **"STUDENT"**.
4. Log in with the new credentials.
5. **Verify**: You should see the Student Dashboard (currently Redirects to Exam page).

### Scenario B: Exam Creation (Invigilator Flow)
1. Log out or open a private window.
2. Log in as an **Invigilator** (use existing `invigilator1` / `invig123`).
3. (Optional) Create a new exam from the backend API or use the existing placeholder exam.
4. Go to the **Invigilator Dashboard**.
5. **Verify**: The dashboard should show 0 students initially (if sample data is removed).

### Scenario C: Live Proctoring (End-to-End)
1. **Student Window**: Log in as a student and "Join" an exam.
2. **Webcam Check**: Ensure the camera preview is visible and the "AI Face Guide" overlay appears.
3. **Behavioral Actions**:
   - **Tab Switching**: Switch to another browser tab for a few seconds.
   - **Eye Deviation**: Look away from the screen or look down repeatedly.
   - **Motion**: Move around suddenly or leave the frame.
4. **Invigilator Window**: Check the dashboard in real-time.
5. **Verify**:
   - The student should appear in the "Live Students" list.
   - Risk score should increase based on the actions above.
   - Live alerts (e.g., "TAB_SWITCH detected") should pop up.

### Scenario D: Report Generation
1. End the exam session (Leave).
2. As an Invigilator, click on the student in the dashboard.
3. Click **"View Report"** or **"Download PDF"**.
4. **Verify**: A PDF report is generated containing the timeline of detected events and the final risk score.

### Scenario E: Offline Synchronization
1. While in an exam as a student, disconnect your internet (or stop the Backend service).
2. Perform some suspicious actions (tab switch, etc.).
3. Reconnect the internet (or restart Backend).
4. **Verify**: The offline events are synced, and the Invigilator Dashboard updates with the missed events.

---

## 3. Advanced Verification (Blockchain)
1. Log in as **Admin** (`admin` / `admin123`).
2. Go to the **Admin Dashboard**.
3. Locate the **"Blockchain Integrity"** section.
4. **Verify**: The system should display "VALID" if no log entries have been tampered with.
