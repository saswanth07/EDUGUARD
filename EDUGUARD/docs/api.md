# EduGuardian 2.0 API Documentation

## Base URL
```
http://localhost:8080/api
```

## Authentication
All endpoints (except `/api/auth/**`) require a JWT Bearer token.

### Headers
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

---

## Auth Endpoints

### POST `/api/auth/login`
Login and receive JWT token.

**Request Body:**
```json
{ "username": "admin", "password": "admin123" }
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGci...",
    "username": "admin",
    "fullName": "System Administrator",
    "role": "ADMIN",
    "userId": 1
  }
}
```

### POST `/api/auth/register`
Register a new user.

**Request Body:**
```json
{
  "username": "newuser",
  "email": "new@example.com",
  "password": "password123",
  "fullName": "New User",
  "role": "STUDENT",
  "department": "Computer Science"
}
```

---

## Exam Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/exams` | Any | List all exams |
| GET | `/api/exams/{id}` | Any | Get exam by ID |
| GET | `/api/exams/code/{code}` | Any | Get exam by code |
| POST | `/api/exams` | ADMIN/INVIGILATOR | Create exam |
| PUT | `/api/exams/{id}/status?status=ACTIVE` | ADMIN/INVIGILATOR | Update status |
| GET | `/api/exams/creator/{userId}` | Any | Get exams by creator |

---

## Proctor Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/proctor/event` | Any | Log a proctor event |
| POST | `/api/proctor/visual-event` | Any | Log visual detection |
| POST | `/api/proctor/audio-event` | Any | Log audio detection |
| POST | `/api/proctor/sync` | Any | Sync offline events |
| GET | `/api/proctor/logs/{examId}` | ADMIN/INVIGILATOR | Get exam logs |
| GET | `/api/proctor/logs/{examId}/{studentId}` | Any | Get student logs |
| GET | `/api/proctor/risk/{examId}/{studentId}` | Any | Get latest risk score |
| GET | `/api/proctor/risk/{examId}/rankings` | ADMIN/INVIGILATOR | Risk rankings |
| GET | `/api/proctor/risk/{examId}/{studentId}/history` | Any | Risk history |
| GET | `/api/proctor/report/{examId}/{studentId}` | ADMIN/INVIGILATOR | Download PDF |
| GET | `/api/proctor/blockchain/validate` | ADMIN | Validate chain |
| GET | `/api/proctor/blockchain/length` | Any | Chain length |

---

## Student Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/student/join/{examCode}?studentId=X` | Any | Join exam |
| POST | `/api/student/leave/{examId}/{studentId}` | Any | Leave exam |
| POST | `/api/student/device-log` | Any | Log device info |
| GET | `/api/student/my-risk/{examId}/{studentId}` | Any | View own risk |
| GET | `/api/student/attendance/{examId}` | Any | Attendance list |

---

## Admin Endpoints (ADMIN role only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/dashboard` | System statistics |
| GET | `/api/admin/users` | All users |
| GET | `/api/admin/users/role/{role}` | Users by role |
| GET | `/api/admin/analytics/events/{examId}` | Event analytics |
| GET | `/api/admin/analytics/high-risk/{examId}` | High-risk students |
| GET | `/api/admin/analytics/department-scores/{examId}` | Dept averages |
| GET | `/api/admin/alerts/{examId}` | Alerts + unread count |
| DELETE | `/api/admin/users/{id}` | Delete user |

---

## WebSocket

### Endpoint
```
ws://localhost:8080/ws (SockJS)
```

### Topics
| Destination | Description |
|-------------|-------------|
| `/topic/proctor-events` | All proctor events |
| `/topic/risk-updates` | Risk score changes |
| `/topic/exam/{examId}/alerts` | Exam-specific alerts |
| `/topic/exam/{examId}/student/{studentId}/risk` | Student risk updates |

### Send
| Destination | Description |
|-------------|-------------|
| `/app/proctor.event` | Send proctor event |
| `/app/risk.update` | Send risk update |

---

## AI Service (Python FastAPI)

### Base URL: `http://localhost:8000`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Health check |
| POST | `/api/detect/frame` | YOLOv8 object detection (file upload) |
| POST | `/api/detect/audio` | Whisper audio analysis (file upload) |
| POST | `/api/detect/motion` | OpenCV motion detection (file upload) |
| POST | `/api/risk/calculate` | Risk score fusion (JSON) |

---

## Risk Score Model

| Category | Max Score | Triggers |
|----------|-----------|----------|
| Eye Deviation | 20 | Eye movement, looking down |
| Head Pose | 10 | Head turns, repeated head movement |
| Multi-Face | 10 | Multiple faces, person behind |
| Phone Detection | 20 | Phone visible in frame |
| Audio Whisper | 15 | Whispering, talking, multiple voices |
| Tab Switch | 15 | Tab switch, copy/paste, minimize |
| Sudden Movement | 10 | Rapid movement, paper passing |
| **Total** | **100** | |

### Risk Levels
- **LOW**: 0-39
- **MEDIUM**: 40-59
- **HIGH**: 60-79
- **CRITICAL**: 80-100
