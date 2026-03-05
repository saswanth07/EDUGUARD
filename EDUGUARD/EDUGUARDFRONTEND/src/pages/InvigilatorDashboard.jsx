import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import RiskGauge from '../components/RiskGauge';
import AlertList from '../components/AlertList';
import ExamFormModal from '../components/ExamFormModal';
import { api } from '../services/api';
import { wsService } from '../services/websocket';
import './InvigilatorDashboard.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler);

export default function InvigilatorDashboard({ user }) {
    const { examId: paramExamId } = useParams();
    const [filter, setFilter] = useState('all');
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [students, setStudents] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [view, setView] = useState('grid');
    const [loading, setLoading] = useState(true);
    const [isExamModalOpen, setIsExamModalOpen] = useState(false);

    // Exam selection state
    const [exams, setExams] = useState([]);
    const [loadingExams, setLoadingExams] = useState(true);
    const [activeExamId, setActiveExamId] = useState(paramExamId ? Number(paramExamId) : null);
    const [submissions, setSubmissions] = useState([]);
    const [riskHistory, setRiskHistory] = useState([0, 0, 0, 0, 0, 0]);

    const fetchExams = useCallback(async () => {
        try {
            const res = await api.getExams();
            if (res.success && res.data) {
                setExams(res.data);
                // Auto-select the first live/scheduled exam if no exam is selected
                if (!activeExamId && res.data.length > 0) {
                    const live = res.data.find(e => e.status === 'LIVE') || res.data[0];
                    setActiveExamId(live.id);
                }
            }
        } catch (err) {
            console.error('Failed to load exams:', err);
            setError(err.message || 'Failed to connect to server');
        } finally {
            setLoadingExams(false);
            setLoading(false);
        }
    }, [activeExamId]);

    const examId = activeExamId;

    const fetchData = useCallback(async () => {
        if (!examId) return;
        try {
            // Use allSettled so one failing API doesn't break the entire dashboard
            const results = await Promise.allSettled([
                api.getRiskRankings(examId),
                api.getExamLogs(examId),
                api.getSubmissions(examId),
                api.getAttendance(examId),
            ]);

            const safe = (idx) => {
                const r = results[idx];
                if (r.status === 'fulfilled') return r.value;
                console.warn(`[Dashboard] API call ${idx} failed:`, r.reason?.message);
                return { success: false, data: [] };
            };

            const rankRes = safe(0);
            const logRes = safe(1);
            const subRes = safe(2);
            const attRes = safe(3);

            console.log('[Dashboard] Attendance:', attRes.data?.length || 0,
                'Submissions:', subRes.data?.length || 0,
                'Rankings:', rankRes.data?.length || 0,
                'Logs:', logRes.data?.length || 0);

            // Build a risk lookup: studentId → risk data
            const riskMap = {};
            if (rankRes.success && rankRes.data) {
                rankRes.data.forEach(s => { riskMap[s.studentId] = s; });
            }

            const subs = (subRes.success && subRes.data) ? subRes.data : [];

            // Build student list from ATTENDANCE (everyone who joined)
            if (attRes.success && attRes.data && attRes.data.length > 0) {
                const mapped = attRes.data.map(att => {
                    const sid = att.student?.id || att.studentId;
                    const risk = riskMap[sid] || {};
                    const totalScore = risk.totalScore || 0;
                    const hasSubmitted = subs.some(
                        s => (s.student?.id || s.studentId) === sid
                    );
                    return {
                        id: sid,
                        name: att.student?.fullName || att.student?.username || `Student #${sid}`,
                        department: risk.department || att.student?.department || 'N/A',
                        risk: totalScore,
                        level: risk.riskLevel || 'LOW',
                        attention: Math.max(0, 100 - ((risk.eyeDeviationScore || 0) + (risk.headPoseScore || 0))),
                        status: hasSubmitted ? 'submitted' : (att.leftAt ? 'left' : 'online'),
                        joinedAt: att.joinedAt,
                    };
                });
                setStudents(mapped);
            } else if (subs.length > 0) {
                // If no attendance records but submissions exist, build from submissions
                const mapped = subs.map(sub => ({
                    id: sub.student?.id || sub.studentId,
                    name: sub.student?.fullName || `Student #${sub.student?.id}`,
                    department: sub.student?.department || 'N/A',
                    risk: 0,
                    level: 'LOW',
                    attention: 100,
                    status: 'submitted',
                }));
                setStudents(mapped);
            } else if (rankRes.success && rankRes.data && rankRes.data.length > 0) {
                // Fallback: use risk rankings
                const mapped = rankRes.data.map(s => ({
                    id: s.studentId,
                    name: `Student #${s.studentId}`,
                    department: s.department || 'CS',
                    risk: s.totalScore,
                    level: s.riskLevel || 'LOW',
                    attention: 100 - ((s.eyeDeviationScore || 0) + (s.headPoseScore || 0)),
                    status: 'online',
                }));
                setStudents(mapped);
            }

            if (logRes.success && logRes.data) setAlerts(logRes.data);
            setSubmissions(subs);
        } catch (err) {
            console.error('Dashboard error:', err);
        } finally {
            setLoading(false);
            // Dynamic risk history tracking
            if (activeExamId) {
                setStudents(prev => {
                    if (prev.length > 0) {
                        const newAvg = Math.round(prev.reduce((a, s) => a + s.risk, 0) / prev.length);
                        setRiskHistory(h => [...h.slice(1), newAvg]);
                    }
                    return prev;
                });
            }
        }
    }, [examId, activeExamId]);

    // Auto-refresh every 10 seconds so new students appear without manual reload
    useEffect(() => {
        if (!examId) return;
        fetchData();
        const poll = setInterval(fetchData, 10000);
        return () => clearInterval(poll);
    }, [examId, fetchData]);

    useEffect(() => {
        fetchExams();

        if (examId) {
            fetchData();
        }

        if (!wsService.isConnected()) {
            wsService.connect();
        }

        const unsubEvents = wsService.subscribeToProctorEvents((event) => {
            setAlerts(prev => [event, ...prev].slice(0, 50));
        });

        const unsubExams = examId ? wsService.subscribeToExam(examId, (update) => {
            if (update.type === 'RISK_UPDATE') {
                setStudents(prev => prev.map(s => s.id === update.studentId ? { ...s, risk: update.totalScore, level: update.riskLevel } : s));
            }
        }) : () => { };

        return () => {
            unsubEvents();
            unsubExams();
        };
    }, [examId, fetchData, fetchExams]);

    const filteredStudents = students.filter((s) => {
        if (filter === 'all') return true;
        if (filter === 'high') return s.risk >= 60;
        if (filter === 'online') return s.status === 'online';
        return true;
    }).sort((a, b) => b.risk - a.risk);

    const avgRisk = students.length === 0 ? 0 : Math.round(students.reduce((a, s) => a + s.risk, 0) / students.length);
    const criticalCount = students.filter((s) => s.risk >= 80).length;
    const highCount = students.filter((s) => s.risk >= 60 && s.risk < 80).length;

    const riskChartData = {
        labels: students.map((s) => s.name.split(' ')[0]),
        datasets: [{
            label: 'Risk Score',
            data: students.map((s) => Math.round(s.risk)),
            backgroundColor: students.map((s) =>
                s.risk >= 80 ? 'rgba(220, 38, 38, 0.7)' :
                    s.risk >= 60 ? 'rgba(239, 68, 68, 0.7)' :
                        s.risk >= 40 ? 'rgba(245, 158, 11, 0.7)' :
                            'rgba(16, 185, 129, 0.7)'
            ),
            borderRadius: 6,
            borderSkipped: false,
        }],
    };

    const timelineData = {
        labels: ['-5m', '-4m', '-3m', '-2m', '-1m', 'Now'],
        datasets: [{
            label: 'Avg Risk',
            data: riskHistory,
            borderColor: '#6366f1',
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: '#6366f1',
        }],
    };

    const distributionData = {
        labels: ['Low', 'Medium', 'High', 'Critical'],
        datasets: [{
            data: [
                students.filter((s) => s.risk < 40).length,
                students.filter((s) => s.risk >= 40 && s.risk < 60).length,
                students.filter((s) => s.risk >= 60 && s.risk < 80).length,
                students.filter((s) => s.risk >= 80).length,
            ],
            backgroundColor: ['#10b981', '#f59e0b', '#ef4444', '#dc2626'],
            borderWidth: 0,
        }],
    };

    const [error, setError] = useState(null);

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: 'rgba(10, 14, 26, 0.9)',
                titleColor: '#f1f5f9',
                bodyColor: '#94a3b8',
                borderColor: 'rgba(99, 102, 241, 0.3)',
                borderWidth: 1,
                cornerRadius: 8,
                padding: 10,
            },
        },
        scales: {
            x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 10 } } },
            y: { grid: { color: 'rgba(148, 163, 184, 0.08)' }, ticks: { color: '#64748b', font: { size: 10 } }, min: 0, max: 100 },
        },
    };

    if (loading && !exams.length) {
        return (
            <div className="flex-center" style={{ height: '80vh', flexDirection: 'column', gap: '20px' }}>
                <span className="spinner" style={{ width: '40px', height: '40px' }}></span>
                <p style={{ color: 'var(--text-secondary)' }}>Loading your dashboard...</p>
            </div>
        );
    }

    if (error && !exams.length) {
        return (
            <div className="flex-center" style={{ height: '80vh', flexDirection: 'column', gap: '20px', textAlign: 'center' }}>
                <div style={{ fontSize: '3rem' }}>😕</div>
                <h3>Dashboard failed to load</h3>
                <p style={{ color: 'var(--accent-danger)', maxWidth: '400px' }}>{error}</p>
                <button className="btn btn-primary" onClick={() => { setError(null); setLoading(true); fetchExams(); }}>
                    🔄 Try Again
                </button>
            </div>
        );
    }

    return (
        <div className="dashboard-page" id="invigilator-dashboard">
            <div className="dashboard-header">
                <div>
                    <h2>Invigilator Dashboard</h2>
                    <p className="text-muted">Live exam monitoring • {students.length} students</p>
                </div>
                <div className="header-actions">
                    <button className="btn btn-primary" onClick={() => setIsExamModalOpen(true)}>
                        <span>📅</span> Schedule Exam
                    </button>
                    <div className="view-toggle">
                        <button className={`btn btn-sm ${view === 'grid' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setView('grid')}>Grid</button>
                        <button className={`btn btn-sm ${view === 'list' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setView('list')}>List</button>
                    </div>
                </div>
            </div>

            {/* Exam Creation Modal */}
            <ExamFormModal
                isOpen={isExamModalOpen}
                onClose={() => setIsExamModalOpen(false)}
                onSuccess={(newExam) => {
                    fetchExams();
                }}
                user={user}
            />

            {/* Exam Selector Panel */}
            <div className="exam-selector-panel card animate-fade">
                <div className="panel-header" style={{ marginBottom: 12 }}>
                    <h5 className="card-title" style={{ margin: 0 }}>📋 Available Exams</h5>
                    <button className="btn btn-sm btn-primary" onClick={() => setIsExamModalOpen(true)}>+ New Exam</button>
                </div>
                {loadingExams ? (
                    <div className="flex-center" style={{ padding: 16 }}><span className="spinner"></span></div>
                ) : exams.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                        <p>No exams found. Create one to start monitoring.</p>
                    </div>
                ) : (
                    <div className="exam-cards-row">
                        {exams.map(exam => (
                            <div
                                key={exam.id}
                                className={`exam-card ${activeExamId === exam.id ? 'exam-card-active' : ''}`}
                                onClick={() => { setActiveExamId(exam.id); setStudents([]); setAlerts([]); }}
                            >
                                <div className="exam-card-top">
                                    <span className="exam-card-title">{exam.title}</span>
                                    <span className={`badge badge-${exam.status === 'LIVE' ? 'danger' : exam.status === 'COMPLETED' ? 'success' : 'warning'}`}>
                                        {exam.status === 'LIVE' ? '🔴 LIVE' : exam.status === 'COMPLETED' ? '✅ Done' : '⏰ Scheduled'}
                                    </span>
                                </div>
                                <div className="exam-card-meta">
                                    <code className="code-badge" style={{ fontSize: '0.75rem' }}>{exam.examCode}</code>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{exam.department}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Submissions Results Table */}
            {submissions.length > 0 && (
                <div className="card animate-fade" style={{ marginBottom: 16 }}>
                    <div className="panel-header" style={{ marginBottom: 12 }}>
                        <h5 className="card-title" style={{ margin: 0 }}>📝 Student Results ({submissions.length} submitted)</h5>
                        <button className="btn btn-sm btn-ghost" onClick={fetchData}>🔄 Refresh</button>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                                    <th style={{ textAlign: 'left', padding: '8px 12px' }}>Student</th>
                                    <th style={{ textAlign: 'center', padding: '8px 12px' }}>Score</th>
                                    <th style={{ textAlign: 'center', padding: '8px 12px' }}>Correct</th>
                                    <th style={{ textAlign: 'center', padding: '8px 12px' }}>Status</th>
                                    <th style={{ textAlign: 'left', padding: '8px 12px' }}>Submitted At</th>
                                </tr>
                            </thead>
                            <tbody>
                                {submissions.map((sub, i) => (
                                    <tr key={sub.id || i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '8px 12px', fontWeight: 600 }}>
                                            {sub.student?.fullName || `Student #${sub.student?.id || i}`}
                                        </td>
                                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                            <span style={{
                                                fontWeight: 800, fontSize: '1rem',
                                                color: (sub.scorePercent || 0) >= 50 ? 'var(--accent-success)' : 'var(--accent-danger)'
                                            }}>
                                                {Math.round(sub.scorePercent || 0)}%
                                            </span>
                                        </td>
                                        <td style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                            {sub.correctAnswers}/{sub.totalQuestions}
                                        </td>
                                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                            <span className={`badge ${sub.status === 'AUTO_SUBMITTED' ? 'badge-warning' : sub.status === 'TIMED_OUT' ? 'badge-danger' : 'badge-success'}`}>
                                                {sub.status || 'SUBMITTED'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '8px 12px', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                            {sub.submittedAt ? new Date(sub.submittedAt).toLocaleTimeString() : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Stats Row */}
            <div className="grid grid-4 stats-grid">
                <div className="stat-card card">
                    <div className="stat-icon" style={{ background: 'rgba(99, 102, 241, 0.12)' }}>👥</div>
                    <div className="stat-info">
                        <span className="stat-value">{students.length}</span>
                        <span className="stat-label">Total Students</span>
                    </div>
                </div>
                <div className="stat-card card">
                    <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.12)' }}>📊</div>
                    <div className="stat-info">
                        <span className="stat-value">{avgRisk}</span>
                        <span className="stat-label">Avg Risk Score</span>
                    </div>
                </div>
                <div className="stat-card card">
                    <div className="stat-icon" style={{ background: 'rgba(239, 68, 68, 0.12)' }}>🚨</div>
                    <div className="stat-info">
                        <span className="stat-value risk-critical">{criticalCount}</span>
                        <span className="stat-label">Critical Alerts</span>
                    </div>
                </div>
                <div className="stat-card card">
                    <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.12)' }}>⚠️</div>
                    <div className="stat-info">
                        <span className="stat-value risk-high">{highCount}</span>
                        <span className="stat-label">High Risk</span>
                    </div>
                </div>
            </div>

            <div className="dashboard-grid">
                {/* Students Panel */}
                <div className="students-panel">
                    <div className="panel-header">
                        <h4>Students</h4>
                        <div className="filter-tabs">
                            {['all', 'high', 'online'].map((f) => (
                                <button key={f} className={`filter-tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                                    {f === 'all' ? 'All' : f === 'high' ? '⚠️ High Priority' : '🟢 Online'}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className={`students-${view}`}>
                        {filteredStudents.map((student) => (
                            <div
                                key={student.id}
                                className={`student-card card risk-bg-${(student.level || 'LOW').toLowerCase()} ${selectedStudent?.id === student.id ? 'selected' : ''}`}
                                onClick={() => setSelectedStudent(student)}
                                id={`student-${student.id}`}
                            >
                                <div className="student-avatar" style={{
                                    background: student.risk >= 80 ? 'var(--gradient-danger)' :
                                        student.risk >= 60 ? 'var(--gradient-warning)' :
                                            'var(--gradient-success)'
                                }}>
                                    {student.name.charAt(0)}
                                </div>
                                <div className="student-info">
                                    <span className="student-name">{student.name}</span>
                                    <span className="student-dept">{student.department}</span>
                                </div>
                                <div className="student-score">
                                    <span className={`score-value risk-${student.level.toLowerCase()}`}>{Math.round(student.risk)}</span>
                                    <span className={`badge badge-${student.level === 'LOW' ? 'success' : student.level === 'MEDIUM' ? 'warning' : 'danger'}`}>
                                        {student.level}
                                    </span>
                                </div>
                                <div className="student-status">
                                    <span className={`status-dot ${student.status}`}></span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Charts & Alerts Panel */}
                <div className="analytics-panel">
                    <div className="card chart-card">
                        <h5 className="card-title">Risk Score Distribution</h5>
                        <div className="chart-container" style={{ height: 220 }}>
                            <Bar data={riskChartData} options={chartOptions} />
                        </div>
                    </div>

                    <div className="charts-row">
                        <div className="card chart-card">
                            <h5 className="card-title">Risk Timeline</h5>
                            <div className="chart-container" style={{ height: 180 }}>
                                <Line data={timelineData} options={chartOptions} />
                            </div>
                        </div>
                        <div className="card chart-card">
                            <h5 className="card-title">Risk Distribution</h5>
                            <div className="chart-container" style={{ height: 180 }}>
                                <Doughnut data={distributionData} options={{ ...chartOptions, scales: undefined, cutout: '65%' }} />
                            </div>
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-header">
                            <h5 className="card-title">Live Alerts</h5>
                            <span className="badge badge-danger">{alerts.length} new</span>
                        </div>
                        <AlertList alerts={alerts} />
                    </div>
                </div>
            </div>

            {/* AI Assistant */}
            <div className="ai-assistant card animate-fade" id="ai-assistant">
                <div className="ai-header">
                    <span className="ai-icon">🤖</span>
                    <h5>AI Invigilator Assistant</h5>
                </div>
                <div className="ai-recommendations">
                    {students.filter(s => s.risk >= 80).map((s, i) => (
                        <div key={`critical-${i}`} className="ai-rec risk-bg-critical">
                            <strong>🔴 Immediate Action:</strong> Critical risk detected for <b>{s.name}</b> (Score: {Math.round(s.risk)}). Please review their live feed and proctor logs immediately.
                        </div>
                    ))}
                    {students.filter(s => s.risk >= 60 && s.risk < 80).map((s, i) => (
                        <div key={`high-${i}`} className="ai-rec risk-bg-high">
                            <strong>🟠 Attention:</strong> High risk activity flagged for <b>{s.name}</b>. Monitoring status: Close scrutiny recommended.
                        </div>
                    ))}
                    {students.length > 0 && students.every(s => s.risk < 60) && (
                        <div className="ai-rec risk-bg-low">
                            <strong>✅ Overall Status:</strong> All {students.length} students are currently within acceptable integrity thresholds. Exam proceeding normally.
                        </div>
                    )}
                    {students.length === 0 && (
                        <div className="ai-rec risk-bg-low">
                            <strong>ℹ️ Waiting for data:</strong> No students have joined this exam session yet.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
