import { useState } from 'react';
import './Navbar.css';

export default function Navbar({ user, onLogout, theme, toggleTheme }) {
    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <nav className="navbar" id="main-navbar">
            <div className="navbar-container">
                <div className="navbar-brand">
                    <div className="brand-icon">
                        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                            <path d="M14 2L3 8v12l11 6 11-6V8L14 2z" fill="url(#shield)" />
                            <path d="M14 7l-6 3.5v7L14 21l6-3.5v-7L14 7z" fill="rgba(255,255,255,0.15)" />
                            <path d="M11 14l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <defs>
                                <linearGradient id="shield" x1="3" y1="2" x2="25" y2="26">
                                    <stop stopColor="#6366f1" />
                                    <stop offset="1" stopColor="#8b5cf6" />
                                </linearGradient>
                            </defs>
                        </svg>
                    </div>
                    <div className="brand-text">
                        <span className="brand-name">EduGuardian</span>
                        <span className="brand-version">2.0</span>
                    </div>
                </div>

                <div className="navbar-center">
                    <div className="connection-status">
                        <span className={`status-dot ${navigator.onLine ? 'online' : 'offline'}`}></span>
                        <span className="status-text">{navigator.onLine ? 'Connected' : 'Offline Mode'}</span>
                    </div>
                </div>

                <div className="navbar-actions">
                    <button
                        className="theme-toggle"
                        onClick={toggleTheme}
                        title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                        id="theme-toggle-btn"
                    >
                        {theme === 'dark' ? (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="5" />
                                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                            </svg>
                        ) : (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                            </svg>
                        )}
                    </button>

                    <div className="user-menu" onClick={() => setMenuOpen(!menuOpen)}>
                        <div className="user-avatar">
                            {user.fullName?.charAt(0) || 'U'}
                        </div>
                        <div className="user-info">
                            <span className="user-name">{user.fullName}</span>
                            <span className={`user-role badge badge-${user.role === 'ADMIN' ? 'danger' : user.role === 'INVIGILATOR' ? 'warning' : 'info'}`}>
                                {user.role}
                            </span>
                        </div>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M6 9l6 6 6-6" />
                        </svg>

                        {menuOpen && (
                            <div className="dropdown-menu animate-fade" id="user-dropdown">
                                <div className="dropdown-header">
                                    <span className="dropdown-email">{user.username}</span>
                                </div>
                                <button className="dropdown-item" onClick={onLogout} id="logout-btn">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
                                    </svg>
                                    Sign Out
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
}
