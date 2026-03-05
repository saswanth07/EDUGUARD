import { useState, useEffect, useCallback } from 'react';
import { Bar, Line, Doughnut, Radar } from 'react-chartjs-2';
import { Chart as ChartJS, RadialLinearScale, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { api } from '../services/api';
import ExamFormModal from '../components/ExamFormModal';
import './AdminDashboard.css';

ChartJS.register(RadialLinearScale, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler);

export default function AdminDashboard({ user }) {
    const [activeTab, setActiveTab] = useState('overview');
    const [stats, setStats] = useState({
        totalUsers: 0, totalStudents: 0, totalInvigilators: 0, totalAdmins: 0,
        totalExams: 0, activeExams: 0, completedExams: 0,
        totalProctorEvents: 0, avgRiskScore: 0, criticalIncidents: 0, totalRiskScores: 0,
    });
    const [loading, setLoading] = useState(true);
    const [exams, setExams] = useState([]);
    const [loadingExams, setLoadingExams] = useState(false);
    const [isExamModalOpen, setIsExamModalOpen] = useState(false);
    const [users, setUsers] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(false);

    const [departmentData, setDepartmentData] = useState({
        labels: ['Computer Science', 'Mathematics', 'Physics', 'Chemistry'],
        datasets: [{ label: 'Avg Risk Score', data: [35, 28, 42, 18], backgroundColor: ['rgba(99,102,241,0.6)', 'rgba(139,92,246,0.6)', 'rgba(236,72,153,0.6)', 'rgba(34,211,238,0.6)'] }]
    });

    const [trendData, setTrendData] = useState({
        labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6'],
        datasets: [{
            label: 'Avg Risk Score',
            data: [25, 32, 28, 45, 38, 30],
            borderColor: '#6366f1',
            backgroundColor: 'rgba(99,102,241,0.1)',
            tension: 0.4,
            fill: true,
        }]
    });

    const [violationData, setViolationData] = useState({
        labels: ['Tab Switch', 'Face Not Visible', 'Multiple Faces', 'Eye Deviation', 'Audio Alert', 'Motion'],
        datasets: [{ data: [35, 25, 15, 12, 8, 5], backgroundColor: ['#ef4444', '#f59e0b', '#8b5cf6', '#3b82f6', '#10b981', '#ec4899'] }]
    });

    const [heatmapData, setHeatmapData] = useState({
        labels: ['Tab Switch', 'Face', 'Eyes', 'Audio', 'Motion', 'Multiple Faces'],
        datasets: [{ label: 'Risk Impact', data: [85, 70, 55, 40, 30, 65], backgroundColor: 'rgba(99, 102, 241, 0.3)', borderColor: '#6366f1', pointBackgroundColor: '#6366f1' }]
    });

    const handleToggleStatus = async (examId, currentStatus) => {
        const nextStatus = currentStatus === 'SCHEDULED' ? 'LIVE' : (currentStatus === 'LIVE' ? 'COMPLETED' : 'SCHEDULED');
        try {
            const res = await api.updateExamStatus(examId, nextStatus);
            if (res.success) fetchExams();
        } catch (err) {
            console.error("Status update failed:", err);
        }
    };

    const fetchExams = useCallback(async () => {
        setLoadingExams(true);
        try {
            const res = await api.getExams();
            if (res.success) setExams(res.data || []);
        } catch (err) {
            console.error("Exams load failed:", err);
        } finally {
            setLoadingExams(false);
        }
    }, []);

    const fetchUsers = useCallback(async () => {
        setLoadingUsers(true);
        try {
            const res = await api.getAllUsers();
            if (res.success) setUsers(res.data || []);
        } catch (err) {
            console.error("Users load failed:", err);
        } finally {
            setLoadingUsers(false);
        }
    }, []);

    const fetchData = useCallback(async () => {
        try {
            const statsRes = await api.getDashboardStats();
            if (statsRes.success && statsRes.data) {
                setStats(prev => ({ ...prev, ...statsRes.data }));
            }
        } catch (err) {
            console.error("Dashboard stats load failed:", err);
        }

        try {
            const examAnalyticsRes = await api.getEventAnalytics(1);
            if (examAnalyticsRes.success && examAnalyticsRes.data) {
                console.log("Analytics loaded:", examAnalyticsRes.data);
            }
        } catch (err) {
            // Analytics may fail if no exam id=1 exists, that's okay
        }

        setLoading(false);
    }, []);

    useEffect(() => {
        fetchData();
        fetchExams();
    }, [fetchData, fetchExams]);

    useEffect(() => {
        if (activeTab === 'users') fetchUsers();
    }, [activeTab, fetchUsers]);

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: true, position: 'bottom', labels: { color: '#94a3b8', padding: 15, font: { size: 11 } } },
            tooltip: {
                backgroundColor: 'rgba(10, 14, 26, 0.9)',
                titleColor: '#f1f5f9',
                bodyColor: '#94a3b8',
                borderColor: 'rgba(99, 102, 241, 0.3)',
                borderWidth: 1,
                cornerRadius: 8,
            },
        },
        scales: {
            x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 10 } } },
            y: { grid: { color: 'rgba(148, 163, 184, 0.08)' }, ticks: { color: '#64748b', font: { size: 10 } } },
        },
    };

    const radarOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
        },
        scales: {
            r: {
                grid: { color: 'rgba(148, 163, 184, 0.1)' },
                ticks: { display: false },
                pointLabels: { color: '#94a3b8', font: { size: 10 } },
            },
        },
    };

    const doughnutOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'right', labels: { color: '#94a3b8', padding: 10, font: { size: 11 } } },
        },
    };

    const tabs = [
        { id: 'overview', label: '📊 Overview' },
        { id: 'exams', label: '📝 Exams' },
        { id: 'analytics', label: '📈 Analytics' },
        { id: 'users', label: '👥 Users' },
        { id: 'reports', label: '📋 Reports' },
    ];

    if (loading) return (
        <div className="admin-page flex-center" style={{ height: '80vh' }}>
            <span className="spinner"></span>
            <p style={{ marginTop: 15, color: '#94a3b8' }}>Loading analytics dashboard...</p>
        </div>
    );

    return (
        <div className="admin-page" id="admin-dashboard">
            <div className="admin-header">
                <div>
                    <h2>Admin Dashboard</h2>
                    <p className="text-muted">System analytics & management</p>
                </div>
                <div className="admin-tabs">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ============= OVERVIEW TAB ============= */}
            {activeTab === 'overview' && (
                <>
                    {/* Stats Cards */}
                    <div className="grid grid-4 stats-grid">
                        <div className="stat-card card stat-gradient-1">
                            <div className="stat-icon-lg">👥</div>
                            <div className="stat-info">
                                <span className="stat-value-lg">{stats.totalStudents}</span>
                                <span className="stat-label">Total Students</span>
                            </div>
                        </div>
                        <div className="stat-card card stat-gradient-2" onClick={() => setActiveTab('exams')} style={{ cursor: 'pointer' }}>
                            <div className="stat-icon-lg">📝</div>
                            <div className="stat-info">
                                <span className="stat-value-lg">{stats.totalExams}</span>
                                <span className="stat-label">Total Exams</span>
                            </div>
                        </div>
                        <div className="stat-card card stat-gradient-3">
                            <div className="stat-icon-lg">📊</div>
                            <div className="stat-info">
                                <span className="stat-value-lg">{stats.totalProctorEvents}</span>
                                <span className="stat-label">Proctor Events</span>
                            </div>
                        </div>
                        <div className="stat-card card stat-gradient-4">
                            <div className="stat-icon-lg">🛡️</div>
                            <div className="stat-info">
                                <span className="stat-value-lg">{stats.totalRiskScores}</span>
                                <span className="stat-label">Risk Assessments</span>
                            </div>
                        </div>
                    </div>

                    {/* Charts Grid */}
                    <div className="admin-charts-grid">
                        <div className="card chart-card-lg">
                            <h5 className="card-title">Risk Score Trends</h5>
                            <div className="chart-container" style={{ height: 280 }}>
                                <Line data={trendData} options={chartOptions} />
                            </div>
                        </div>
                        <div className="card chart-card-lg">
                            <h5 className="card-title">Department Risk Comparison</h5>
                            <div className="chart-container" style={{ height: 280 }}>
                                <Bar data={departmentData} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, legend: { display: false } } }} />
                            </div>
                        </div>
                    </div>

                    {/* Recent Exams Quick View */}
                    <div className="card" style={{ padding: '24px' }}>
                        <h5 className="card-title" style={{ marginBottom: 16 }}>Recent Exams</h5>
                        {exams.length === 0 ? (
                            <p className="text-muted" style={{ textAlign: 'center', padding: 20 }}>No exams scheduled yet. Go to the Exams tab to create one.</p>
                        ) : (
                            <div className="table-responsive">
                                <table className="admin-table">
                                    <thead>
                                        <tr><th>Title</th><th>Code</th><th>Duration</th><th>Status</th></tr>
                                    </thead>
                                    <tbody>
                                        {exams.slice(0, 5).map(exam => (
                                            <tr key={exam.id}>
                                                <td><strong>{exam.title}</strong><br /><small className="text-muted">{exam.department}</small></td>
                                                <td><code className="code-badge">{exam.examCode}</code></td>
                                                <td>{exam.durationMinutes}m</td>
                                                <td><span className={`badge badge-${exam.status === 'LIVE' ? 'danger' : exam.status === 'COMPLETED' ? 'success' : 'info'}`}>{exam.status}</span></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* ============= EXAMS TAB ============= */}
            {activeTab === 'exams' && (
                <div className="exams-panel card animate-fade">
                    <div className="panel-header" style={{ marginBottom: 20 }}>
                        <h4>Exam Management</h4>
                        <button className="btn btn-primary" onClick={() => setIsExamModalOpen(true)}>
                            <span>+</span> Schedule Exam
                        </button>
                    </div>

                    {loadingExams ? (
                        <div className="flex-center" style={{ padding: 40 }}><span className="spinner"></span></div>
                    ) : (
                        <div className="table-responsive">
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>Title</th><th>Code</th><th>Start Time</th><th>Duration</th>
                                        <th>Students</th><th>Status</th><th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {exams.map(exam => (
                                        <tr key={exam.id}>
                                            <td><strong>{exam.title}</strong><br /><small>{exam.department}</small></td>
                                            <td><code className="code-badge">{exam.examCode}</code></td>
                                            <td>{new Date(exam.startTime).toLocaleString()}</td>
                                            <td>{exam.durationMinutes}m</td>
                                            <td>{exam.totalStudents || 0} / {exam.maxStudents}</td>
                                            <td><span className={`badge badge-${exam.status === 'LIVE' ? 'danger' : exam.status === 'COMPLETED' ? 'success' : 'info'}`}>{exam.status}</span></td>
                                            <td>
                                                <div className="action-btns">
                                                    <button
                                                        className={`btn-icon ${exam.status === 'LIVE' ? 'active' : ''}`}
                                                        title={exam.status === 'SCHEDULED' ? 'Start Exam' : 'End Exam'}
                                                        onClick={() => handleToggleStatus(exam.id, exam.status)}
                                                        disabled={exam.status === 'COMPLETED'}
                                                    >
                                                        {exam.status === 'SCHEDULED' ? '▶️' : (exam.status === 'LIVE' ? '⏹️' : '✅')}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {exams.length === 0 && (
                                        <tr><td colSpan="7" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No exams scheduled yet.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ============= ANALYTICS TAB ============= */}
            {activeTab === 'analytics' && (
                <div className="animate-fade">
                    <div className="grid grid-4 stats-grid" style={{ marginBottom: 24 }}>
                        <div className="stat-card card stat-gradient-1">
                            <div className="stat-info" style={{ textAlign: 'center' }}>
                                <span className="stat-value-lg">{stats.totalProctorEvents}</span>
                                <span className="stat-label">Total Events Logged</span>
                            </div>
                        </div>
                        <div className="stat-card card stat-gradient-2">
                            <div className="stat-info" style={{ textAlign: 'center' }}>
                                <span className="stat-value-lg">{stats.totalRiskScores}</span>
                                <span className="stat-label">Risk Scores Generated</span>
                            </div>
                        </div>
                        <div className="stat-card card stat-gradient-3">
                            <div className="stat-info" style={{ textAlign: 'center' }}>
                                <span className="stat-value-lg">{stats.totalExams}</span>
                                <span className="stat-label">Exams Monitored</span>
                            </div>
                        </div>
                        <div className="stat-card card stat-gradient-4">
                            <div className="stat-info" style={{ textAlign: 'center' }}>
                                <span className="stat-value-lg">{stats.totalUsers}</span>
                                <span className="stat-label">Total Users</span>
                            </div>
                        </div>
                    </div>

                    <div className="admin-charts-grid">
                        <div className="card chart-card-lg">
                            <h5 className="card-title">Violation Distribution</h5>
                            <div className="chart-container" style={{ height: 300 }}>
                                <Doughnut data={violationData} options={doughnutOptions} />
                            </div>
                        </div>
                        <div className="card chart-card-lg">
                            <h5 className="card-title">Risk Factor Radar</h5>
                            <div className="chart-container" style={{ height: 300 }}>
                                <Radar data={heatmapData} options={radarOptions} />
                            </div>
                        </div>
                    </div>

                    <div className="admin-charts-grid">
                        <div className="card chart-card-lg">
                            <h5 className="card-title">Risk Score Trends Over Time</h5>
                            <div className="chart-container" style={{ height: 280 }}>
                                <Line data={trendData} options={chartOptions} />
                            </div>
                        </div>
                        <div className="card chart-card-lg">
                            <h5 className="card-title">Department-wise Analysis</h5>
                            <div className="chart-container" style={{ height: 280 }}>
                                <Bar data={departmentData} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, legend: { display: false } } }} />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ============= USERS TAB ============= */}
            {activeTab === 'users' && (
                <div className="card animate-fade" style={{ padding: 24 }}>
                    <div className="panel-header" style={{ marginBottom: 20 }}>
                        <h4>User Management</h4>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <span className="badge badge-info">Students: {users.filter(u => u.role === 'STUDENT').length}</span>
                            <span className="badge badge-warning">Invigilators: {users.filter(u => u.role === 'INVIGILATOR').length}</span>
                            <span className="badge badge-danger">Admins: {users.filter(u => u.role === 'ADMIN').length}</span>
                        </div>
                    </div>

                    {loadingUsers ? (
                        <div className="flex-center" style={{ padding: 40 }}><span className="spinner"></span></div>
                    ) : (
                        <div className="table-responsive">
                            <table className="admin-table">
                                <thead>
                                    <tr><th>Name</th><th>Username</th><th>Email</th><th>Role</th><th>Department</th><th>Status</th></tr>
                                </thead>
                                <tbody>
                                    {users.map(u => (
                                        <tr key={u.id}>
                                            <td><strong>{u.fullName}</strong></td>
                                            <td>{u.username}</td>
                                            <td>{u.email}</td>
                                            <td>
                                                <span className={`badge badge-${u.role === 'ADMIN' ? 'danger' : u.role === 'INVIGILATOR' ? 'warning' : 'info'}`}>
                                                    {u.role}
                                                </span>
                                            </td>
                                            <td>{u.department || '—'}</td>
                                            <td>
                                                <span className={`badge badge-${u.isActive || u.active ? 'success' : 'ghost'}`}>
                                                    {u.isActive || u.active ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {users.length === 0 && (
                                        <tr><td colSpan="6" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No users found.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ============= REPORTS TAB ============= */}
            {activeTab === 'reports' && (
                <div className="animate-fade">
                    <div className="grid grid-3" style={{ gap: 20, marginBottom: 24 }}>
                        <div className="card" style={{ padding: 24, textAlign: 'center' }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>📊</div>
                            <h5 style={{ marginBottom: 8 }}>System Summary</h5>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span className="text-muted">Total Users</span>
                                    <strong>{stats.totalUsers}</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span className="text-muted">Students</span>
                                    <strong>{stats.totalStudents}</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span className="text-muted">Invigilators</span>
                                    <strong>{stats.totalInvigilators}</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span className="text-muted">Total Exams</span>
                                    <strong>{stats.totalExams}</strong>
                                </div>
                            </div>
                        </div>

                        <div className="card" style={{ padding: 24, textAlign: 'center' }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🛡️</div>
                            <h5 style={{ marginBottom: 8 }}>Proctoring Summary</h5>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span className="text-muted">Events Logged</span>
                                    <strong>{stats.totalProctorEvents}</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span className="text-muted">Risk Scores</span>
                                    <strong>{stats.totalRiskScores}</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span className="text-muted">AI Detections</span>
                                    <strong>Active</strong>
                                </div>
                            </div>
                        </div>

                        <div className="card" style={{ padding: 24, textAlign: 'center' }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>📝</div>
                            <h5 style={{ marginBottom: 8 }}>Exam Status</h5>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span className="text-muted">Scheduled</span>
                                    <strong>{exams.filter(e => e.status === 'SCHEDULED').length}</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span className="text-muted">Live</span>
                                    <strong style={{ color: '#ef4444' }}>{exams.filter(e => e.status === 'LIVE').length}</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span className="text-muted">Completed</span>
                                    <strong style={{ color: '#10b981' }}>{exams.filter(e => e.status === 'COMPLETED').length}</strong>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Exam Details Report */}
                    <div className="card" style={{ padding: 24 }}>
                        <h5 className="card-title" style={{ marginBottom: 16 }}>All Exams Report</h5>
                        <div className="table-responsive">
                            <table className="admin-table">
                                <thead>
                                    <tr><th>Exam</th><th>Code</th><th>Department</th><th>Duration</th><th>Students</th><th>Status</th><th>Date</th></tr>
                                </thead>
                                <tbody>
                                    {exams.map(exam => (
                                        <tr key={exam.id}>
                                            <td><strong>{exam.title}</strong></td>
                                            <td><code className="code-badge">{exam.examCode}</code></td>
                                            <td>{exam.department || '—'}</td>
                                            <td>{exam.durationMinutes}m</td>
                                            <td>{exam.totalStudents || 0} / {exam.maxStudents}</td>
                                            <td><span className={`badge badge-${exam.status === 'LIVE' ? 'danger' : exam.status === 'COMPLETED' ? 'success' : 'info'}`}>{exam.status}</span></td>
                                            <td>{exam.startTime ? new Date(exam.startTime).toLocaleDateString() : '—'}</td>
                                        </tr>
                                    ))}
                                    {exams.length === 0 && (
                                        <tr><td colSpan="7" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No exam data available.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Exam Creation Modal */}
            <ExamFormModal
                isOpen={isExamModalOpen}
                onClose={() => setIsExamModalOpen(false)}
                onSuccess={(newExam) => {
                    fetchExams();
                    fetchData();
                }}
                user={user}
            />
        </div>
    );
}
