import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import './Login.css';

export default function Register({ onLogin, theme, toggleTheme }) {
    const [form, setForm] = useState({ username: '', email: '', password: '', fullName: '', role: 'STUDENT', department: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await api.register(form);
            if (res.success) {
                localStorage.setItem('eduguardian_token', res.data.token);
                onLogin(res.data);
            } else {
                setError(res.message);
            }
        } catch (err) {
            setError(err.message || 'Registration failed');
        }
        setLoading(false);
    };

    const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

    return (
        <div className="auth-page">
            <div className="auth-bg-effects">
                <div className="bg-orb bg-orb-1"></div>
                <div className="bg-orb bg-orb-2"></div>
            </div>

            <button className="auth-theme-toggle" onClick={toggleTheme}>
                {theme === 'dark' ? '☀️' : '🌙'}
            </button>

            <div className="auth-container animate-fade">
                <div className="auth-header">
                    <h1 className="auth-title">Create Account</h1>
                    <p className="auth-subtitle">Join EduGuardian 2.0</p>
                </div>

                <form className="auth-form" onSubmit={handleSubmit} id="register-form">
                    {error && <div className="auth-error animate-fade">{error}</div>}

                    <div className="input-group">
                        <label htmlFor="reg-fullname">Full Name</label>
                        <input id="reg-fullname" className="input" type="text" placeholder="John Doe" value={form.fullName} onChange={update('fullName')} required />
                    </div>

                    <div className="input-group">
                        <label htmlFor="reg-username">Username</label>
                        <input id="reg-username" className="input" type="text" placeholder="johndoe" value={form.username} onChange={update('username')} required />
                    </div>

                    <div className="input-group">
                        <label htmlFor="reg-email">Email</label>
                        <input id="reg-email" className="input" type="email" placeholder="john@example.com" value={form.email} onChange={update('email')} required />
                    </div>

                    <div className="input-group">
                        <label htmlFor="reg-password">Password</label>
                        <input id="reg-password" className="input" type="password" placeholder="Min 6 characters" value={form.password} onChange={update('password')} required minLength={6} />
                    </div>

                    <div className="input-group">
                        <label htmlFor="reg-role">Role</label>
                        <select id="reg-role" className="input" value={form.role} onChange={update('role')}>
                            <option value="STUDENT">Student</option>
                            <option value="INVIGILATOR">Invigilator</option>
                        </select>
                    </div>

                    <div className="input-group">
                        <label htmlFor="reg-dept">Department</label>
                        <input id="reg-dept" className="input" type="text" placeholder="Computer Science" value={form.department} onChange={update('department')} />
                    </div>

                    <button className="btn btn-primary btn-lg w-full" type="submit" disabled={loading} id="register-submit">
                        {loading ? 'Creating...' : 'Create Account'}
                    </button>
                </form>

                <div className="auth-footer">
                    <p>Already have an account? <Link to="/login">Sign in</Link></p>
                </div>
            </div>
        </div>
    );
}
