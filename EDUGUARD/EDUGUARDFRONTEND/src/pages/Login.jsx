import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import './Login.css';

const DEMO_ACCOUNTS = [
    { label: '🔴 Admin', username: 'admin', password: 'admin123', color: '#ef4444' },
    { label: '🟡 Invigilator', username: 'invigilator1', password: 'invig123', color: '#f59e0b' },
    { label: '🟢 Student', username: 'student1', password: 'student123', color: '#10b981' },
];

export default function Login({ onLogin, theme, toggleTheme }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await api.login({ username, password });
            if (res.success) {
                localStorage.setItem('eduguardian_token', res.data.token);
                onLogin(res.data);
            } else {
                setError(res.message || 'Invalid credentials');
            }
        } catch (err) {
            setError(err.message || 'Login failed');
        }
        setLoading(false);
    };

    const quickFill = (acc) => {
        setUsername(acc.username);
        setPassword(acc.password);
        setError('');
    };

    return (
        <div className="auth-page">
            <div className="auth-bg-effects">
                <div className="bg-orb bg-orb-1"></div>
                <div className="bg-orb bg-orb-2"></div>
                <div className="bg-orb bg-orb-3"></div>
            </div>

            <button className="auth-theme-toggle" onClick={toggleTheme} id="login-theme-toggle">
                {theme === 'dark' ? '☀️' : '🌙'}
            </button>

            <div className="auth-container animate-fade">
                <div className="auth-header">
                    <div className="auth-logo">
                        <svg width="48" height="48" viewBox="0 0 28 28" fill="none">
                            <path d="M14 2L3 8v12l11 6 11-6V8L14 2z" fill="url(#shield2)" />
                            <path d="M11 14l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <defs>
                                <linearGradient id="shield2" x1="3" y1="2" x2="25" y2="26">
                                    <stop stopColor="#6366f1" />
                                    <stop offset="1" stopColor="#8b5cf6" />
                                </linearGradient>
                            </defs>
                        </svg>
                    </div>
                    <h1 className="auth-title">EduGuardian <span className="auth-version">2.0</span></h1>
                    <p className="auth-subtitle">AI-Powered Anti-Cheating Proctoring</p>
                </div>

                <form className="auth-form" onSubmit={handleSubmit} id="login-form">
                    {error && <div className="auth-error animate-fade">{error}</div>}

                    <div className="input-group">
                        <label htmlFor="username">Username</label>
                        <input
                            id="username"
                            className="input"
                            type="text"
                            placeholder="Enter your username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            autoFocus
                        />
                    </div>

                    <div className="input-group">
                        <label htmlFor="password">Password</label>
                        <input
                            id="password"
                            className="input"
                            type="password"
                            placeholder="Enter your password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button className="btn btn-primary btn-lg w-full" type="submit" disabled={loading} id="login-submit">
                        {loading ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }}></span> : null}
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                {/* Demo credentials quick-fill */}
                <div className="demo-accounts">
                    <p className="demo-label">Quick login (demo accounts):</p>
                    <div className="demo-btns">
                        {DEMO_ACCOUNTS.map(acc => (
                            <button
                                key={acc.label}
                                className="demo-btn"
                                style={{ borderColor: acc.color, color: acc.color }}
                                onClick={() => quickFill(acc)}
                                type="button"
                                id={`demo-${acc.username}`}
                            >
                                {acc.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="auth-footer">
                    <p>Don't have an account? <Link to="/register">Create one</Link></p>
                </div>
            </div>
        </div>
    );
}
