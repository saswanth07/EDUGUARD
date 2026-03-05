const API_BASE = 'http://localhost:8080/api';

/**
 * Enhanced fetch with timeout to prevent dashboard hangs
 */
const fetchWithTimeout = async (url, options = {}, timeout = 30000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        if (error.name === 'AbortError') {
            throw new Error(`Request timed out after ${timeout / 1000}s. Please check your connection or try again.`);
        }
        throw error;
    }
};

const getHeaders = () => {
    const token = localStorage.getItem('eduguardian_token');
    return {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
};

const handleResponse = async (res) => {
    const text = await res.text();
    let data = {};
    try {
        if (text) data = JSON.parse(text);
    } catch {
        // Non-JSON body (e.g. Spring Security HTML errors)
    }
    if (!res.ok) {
        throw new Error(
            data.message ||
            (res.status === 403 ? 'Access denied — you do not have permission for this action.' :
                res.status === 401 ? 'Please log in again.' :
                    `HTTP ${res.status}`)
        );
    }
    return data;
};

export const api = {
    // Auth
    login: (credentials) =>
        fetchWithTimeout(`${API_BASE}/auth/login`, {
            method: 'POST', headers: getHeaders(), body: JSON.stringify(credentials),
        }).then(handleResponse),

    register: (userData) =>
        fetchWithTimeout(`${API_BASE}/auth/register`, {
            method: 'POST', headers: getHeaders(), body: JSON.stringify(userData),
        }).then(handleResponse),

    // Exams
    getExams: () =>
        fetchWithTimeout(`${API_BASE}/exams`, { headers: getHeaders() }).then(handleResponse),

    getExam: (id) =>
        fetchWithTimeout(`${API_BASE}/exams/${id}`, { headers: getHeaders() }).then(handleResponse),

    getExamByCode: (code) =>
        fetchWithTimeout(`${API_BASE}/exams/code/${code}`, { headers: getHeaders() }).then(handleResponse),

    createExam: (exam) =>
        fetchWithTimeout(`${API_BASE}/exams`, {
            method: 'POST', headers: getHeaders(), body: JSON.stringify(exam),
        }).then(handleResponse),

    updateExamStatus: (id, status) =>
        fetchWithTimeout(`${API_BASE}/exams/${id}/status?status=${status}`, {
            method: 'PUT', headers: getHeaders(),
        }).then(handleResponse),

    // Proctor
    logEvent: (event) =>
        fetchWithTimeout(`${API_BASE}/proctor/event`, {
            method: 'POST', headers: getHeaders(), body: JSON.stringify(event),
        }).then(handleResponse),

    logVisualEvent: (event) =>
        fetchWithTimeout(`${API_BASE}/proctor/visual-event`, {
            method: 'POST', headers: getHeaders(), body: JSON.stringify(event),
        }).then(handleResponse),

    logAudioEvent: (event) =>
        fetchWithTimeout(`${API_BASE}/proctor/audio-event`, {
            method: 'POST', headers: getHeaders(), body: JSON.stringify(event),
        }).then(handleResponse),

    syncOfflineEvents: (events) =>
        fetchWithTimeout(`${API_BASE}/proctor/sync`, {
            method: 'POST', headers: getHeaders(), body: JSON.stringify(events),
        }).then(handleResponse),

    getExamLogs: (examId) =>
        fetchWithTimeout(`${API_BASE}/proctor/logs/${examId}`, { headers: getHeaders() }).then(handleResponse),

    getStudentLogs: (examId, studentId) =>
        fetchWithTimeout(`${API_BASE}/proctor/logs/${examId}/${studentId}`, { headers: getHeaders() }).then(handleResponse),

    getRiskScore: (examId, studentId) =>
        fetchWithTimeout(`${API_BASE}/proctor/risk/${examId}/${studentId}`, { headers: getHeaders() }).then(handleResponse),

    getRiskRankings: (examId) =>
        fetchWithTimeout(`${API_BASE}/proctor/risk/${examId}/rankings`, { headers: getHeaders() }).then(handleResponse),

    getRiskHistory: (examId, studentId) =>
        fetchWithTimeout(`${API_BASE}/proctor/risk/${examId}/${studentId}/history`, { headers: getHeaders() }).then(handleResponse),

    downloadReport: (examId, studentId) =>
        fetchWithTimeout(`${API_BASE}/proctor/report/${examId}/${studentId}`, { headers: getHeaders() })
            .then(res => res.blob()),

    // Student
    joinExam: (examCode, studentId) =>
        fetchWithTimeout(`${API_BASE}/student/join/${examCode}?studentId=${studentId}`, {
            method: 'POST', headers: getHeaders(),
        }).then(handleResponse),

    leaveExam: (examId, studentId) =>
        fetchWithTimeout(`${API_BASE}/student/leave/${examId}/${studentId}`, {
            method: 'POST', headers: getHeaders(),
        }).then(handleResponse),

    submitExam: (payload) =>
        fetchWithTimeout(`${API_BASE}/student/submit`, {
            method: 'POST', headers: getHeaders(), body: JSON.stringify(payload),
        }).then(handleResponse),

    getSubmissions: (examId) =>
        fetchWithTimeout(`${API_BASE}/student/submissions/${examId}`, { headers: getHeaders() }).then(handleResponse),

    getMyRisk: (examId, studentId) =>
        fetchWithTimeout(`${API_BASE}/student/my-risk/${examId}/${studentId}`, { headers: getHeaders() }).then(handleResponse),

    // Admin
    getDashboardStats: () =>
        fetchWithTimeout(`${API_BASE}/admin/dashboard`, { headers: getHeaders() }).then(handleResponse),

    getAllUsers: () =>
        fetchWithTimeout(`${API_BASE}/admin/users`, { headers: getHeaders() }).then(handleResponse),

    getEventAnalytics: (examId) =>
        fetchWithTimeout(`${API_BASE}/admin/analytics/events/${examId}`, { headers: getHeaders() }).then(handleResponse),

    getHighRiskStudents: (examId) =>
        fetchWithTimeout(`${API_BASE}/admin/analytics/high-risk/${examId}`, { headers: getHeaders() }).then(handleResponse),

    getDepartmentScores: (examId) =>
        fetchWithTimeout(`${API_BASE}/admin/analytics/department-scores/${examId}`, { headers: getHeaders() }).then(handleResponse),

    // AI Question Generation (Python AI service on 8000)
    generateQuestions: (params) =>
        fetchWithTimeout('http://localhost:8000/api/questions/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params),
        }, 60000).then(res => res.json()), // Long 60s timeout for AI generation

    // Risk Score — send accumulated risk to Spring Boot for persistence
    updateRiskScore: (payload) =>
        fetchWithTimeout(`${API_BASE}/proctor/risk/update`, {
            method: 'POST', headers: getHeaders(), body: JSON.stringify(payload),
        }, 5000).then(handleResponse), // Short 5s timeout for background risk updates

    // Risk Calculate — send to Python AI service for fused score
    calculateRisk: (payload) =>
        fetchWithTimeout('http://localhost:8000/api/risk/calculate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        }, 5000).then(res => res.json()), // Short 5s timeout for AI risk calc

    // Attendance — get who joined an exam
    getAttendance: (examId) =>
        fetchWithTimeout(`${API_BASE}/student/attendance/${examId}`, { headers: getHeaders() }).then(handleResponse),
};
