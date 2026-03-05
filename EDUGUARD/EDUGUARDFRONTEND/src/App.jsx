import './styles/global.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Login from './pages/Login';
import Register from './pages/Register';
import StudentExam from './pages/StudentExam';
import InvigilatorDashboard from './pages/InvigilatorDashboard';
import AdminDashboard from './pages/AdminDashboard';
import Navbar from './components/Navbar';

function App() {
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    const stored = localStorage.getItem('eduguardian_user');
    if (stored) setUser(JSON.parse(stored));

    const savedTheme = localStorage.getItem('eduguardian_theme') || 'dark';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('eduguardian_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('eduguardian_user');
    localStorage.removeItem('eduguardian_token');
  };

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('eduguardian_theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  if (!user) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login onLogin={handleLogin} theme={theme} toggleTheme={toggleTheme} />} />
          <Route path="/register" element={<Register onLogin={handleLogin} theme={theme} toggleTheme={toggleTheme} />} />
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <Navbar user={user} onLogout={handleLogout} theme={theme} toggleTheme={toggleTheme} />
      <Routes>
        {user.role === 'STUDENT' && (
          <>
            <Route path="/exam" element={<StudentExam user={user} />} />
            <Route path="*" element={<Navigate to="/exam" />} />
          </>
        )}
        {user.role === 'INVIGILATOR' && (
          <>
            <Route path="/dashboard" element={<InvigilatorDashboard user={user} />} />
            <Route path="*" element={<Navigate to="/dashboard" />} />
          </>
        )}
        {user.role === 'ADMIN' && (
          <>
            <Route path="/admin" element={<AdminDashboard user={user} />} />
            <Route path="/dashboard" element={<InvigilatorDashboard user={user} />} />
            <Route path="*" element={<Navigate to="/admin" />} />
          </>
        )}
      </Routes>
    </BrowserRouter>
  );
}

export default App;
